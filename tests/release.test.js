import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'node:test'
import {
  compareVersions,
  publicationPlan,
  validateRelease,
} from '../scripts/release.js'

const name = '@hypercliq/shutdown-cleanup'
// JSON registries can return null even though application code uses undefined.
const registryNull = JSON.parse('null')
const bytes = Buffer.from('one validated release archive')
const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
const manifest = { name, version: '9.0.0' }
const lock = { ...manifest, packages: { '': { ...manifest } } }
const event = {
  action: 'published',
  release: { tag_name: 'v9.0.0', draft: false, prerelease: false },
}

test('release tag, both lockfile versions, and prerelease flag must agree', () => {
  assert.equal(validateRelease(manifest, lock, event), 'latest')
  const preview = { name, version: '9.0.0-rc.1' }
  assert.equal(
    validateRelease(
      preview,
      { ...preview, packages: { '': preview } },
      {
        action: 'published',
        release: { tag_name: 'v9.0.0-rc.1', draft: false, prerelease: true },
      },
    ),
    'next',
  )
  for (const bad of [
    { ...event, action: 'created' },
    { ...event, release: { ...event.release, tag_name: 'v8.0.3' } },
    { ...event, release: { ...event.release, draft: true } },
    { ...event, release: { ...event.release, prerelease: true } },
  ])
    assert.throws(() => validateRelease(manifest, lock, bad))
  assert.throws(() =>
    validateRelease(manifest, { ...lock, version: '8.0.3' }, event),
  )
  assert.throws(() =>
    validateRelease(
      manifest,
      { ...lock, packages: { '': { ...manifest, version: '8.0.3' } } },
      event,
    ),
  )
  assert.throws(() =>
    validateRelease(manifest, { ...lock, packages: {} }, event),
  )
  for (const version of ['09.0.0', '9.0', '9.0.0-rc.01', '9.0.0+build']) {
    assert.throws(() => validateRelease({ name, version }, lock, event))
  }
})

test('version ordering protects stable and preview tags from rollback', () => {
  for (const [left, right] of [
    ['9.0.0', '8.10.0'],
    ['9.0.0', '9.0.0-rc.1'],
    ['9.0.0-rc.10', '9.0.0-rc.2'],
    ['9.0.0-rc.1', '9.0.0-beta.1'],
    ['9.0.0-rc.1.1', '9.0.0-rc.1'],
    ['9.0.0-rc.a', '9.0.0-rc.1'],
  ]) {
    assert.equal(compareVersions(left, right), 1)
    assert.equal(compareVersions(right, left), -1)
  }
  assert.equal(compareVersions('9.0.0', '9.0.0'), 0)
  assert.equal(compareVersions('9.0.0-rc.1', '9.0.0-rc.1'), 0)
})

const metadata = (versions = {}, tags) => ({
  name,
  versions,
  'dist-tags': tags ?? { latest: '8.0.3' },
})
const plan = (data, overrides = {}) =>
  publicationPlan({
    manifest,
    bytes,
    registry: 'https://registry.npmjs.org/',
    distributionTag: 'latest',
    request: async () => ({ status: 200, json: async () => data }),
    ...overrides,
  })

test('partial-release recovery skips only the identical published archive', async () => {
  const existing = { ...manifest, dist: { integrity } }
  const shasum = createHash('sha1').update(bytes).digest('hex')
  assert.equal(await plan(metadata({ '9.0.0': existing })), 'skip')
  assert.equal(await plan(metadata()), 'publish')
  assert.equal(
    await plan(
      metadata({
        '9.0.0': {
          ...manifest,
          dist: { shasum },
        },
      }),
    ),
    'skip',
  )
  await assert.rejects(
    plan(
      metadata({
        '9.0.0': { ...existing, dist: { integrity: 'sha512-conflicting' } },
      }),
    ),
    /differs/,
  )
  await assert.rejects(
    plan(metadata({ '9.0.0': { ...manifest, dist: {} } })),
    /omitted/,
  )
  await assert.rejects(plan(metadata({}, { latest: '10.0.0' })), /backwards/)
  await assert.rejects(
    plan(metadata({}, { latest: registryNull })),
    /Version must be a string/,
  )
  await assert.rejects(
    plan(metadata(), { distributionTag: 'next' }),
    /distribution tag/,
  )
})

test('unavailable metadata is never evidence of an unpublished version', async () => {
  for (const status of [401, 403, 404, 429, 500]) {
    await assert.rejects(
      plan(undefined, { request: async () => ({ status }) }),
      /publication stopped/,
    )
  }
  await assert.rejects(
    plan(undefined, {
      request: async () => {
        throw new Error('network failure')
      },
    }),
    /network failure/,
  )
  await assert.rejects(plan({ name, 'dist-tags': {} }), /version inventory/)
  await assert.rejects(plan({ name, versions: {} }), /distribution tags/)
  await assert.rejects(
    plan({ name, versions: [], 'dist-tags': {} }),
    /version inventory/,
  )
  await assert.rejects(
    plan({ name, versions: {}, 'dist-tags': [] }),
    /distribution tags/,
  )
  await assert.rejects(
    plan(metadata({ '9.0.0': registryNull })),
    /invalid version metadata/,
  )
  await assert.rejects(
    plan(metadata(), { registry: 'https://npm.pkg.github.com/' }),
    /Only npm publication/,
  )
})

test('npm preview uses next without registry credentials', async () => {
  const preview = { name, version: '9.0.0-rc.2' }
  let requests = 0
  assert.equal(
    await plan(metadata({}, { next: '9.0.0-rc.1' }), {
      manifest: preview,
      registry: 'https://registry.npmjs.org/',
      distributionTag: 'next',
      request: async (url, options) => {
        requests++
        assert.equal(url.origin, 'https://registry.npmjs.org')
        assert.deepEqual(options.headers, {})
        assert.equal(options.redirect, 'error')
        return {
          status: 200,
          json: async () => metadata({}, { next: '9.0.0-rc.1' }),
        }
      },
    }),
    'publish',
  )
  assert.equal(requests, 1)
  await assert.rejects(
    plan(metadata({}, { next: '9.0.0-rc.3' }), {
      manifest: preview,
      distributionTag: 'next',
    }),
    /backwards/,
  )
})
