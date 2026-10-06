import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { verifyArchive } from './archive.js'

const packageName = '@hypercliq/shutdown-cleanup'
const npmRegistry = 'https://registry.npmjs.org/'

// Build metadata is deliberately excluded from the release policy.
export function parseVersion(version) {
  assert.equal(typeof version, 'string', 'Version must be a string')
  const match =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([\dA-Za-z-]+(?:\.[\dA-Za-z-]+)*))?$/.exec(
      version,
    )
  assert.ok(match, `Invalid release version: ${version}`)
  const identifiers = match[4]?.split('.') ?? []
  assert.ok(
    identifiers.every((identifier) => !/^0\d+$/.test(identifier)),
    'Numeric prerelease identifiers must not have leading zeroes',
  )
  return { numbers: match.slice(1, 4).map(BigInt), identifiers }
}

export function compareVersions(left, right) {
  const a = parseVersion(left)
  const b = parseVersion(right)
  for (let index = 0; index < 3; index++) {
    if (a.numbers[index] !== b.numbers[index]) {
      return a.numbers[index] > b.numbers[index] ? 1 : -1
    }
  }
  if (a.identifiers.length === 0 || b.identifiers.length === 0) {
    return Math.sign(b.identifiers.length - a.identifiers.length)
  }
  for (
    let index = 0;
    index < Math.max(a.identifiers.length, b.identifiers.length);
    index++
  ) {
    const x = a.identifiers[index]
    const y = b.identifiers[index]
    if (x === y) continue
    if (x === undefined) return -1
    if (y === undefined) return 1
    const isNumericX = /^\d+$/.test(x)
    const isNumericY = /^\d+$/.test(y)
    if (isNumericX && isNumericY) return BigInt(x) > BigInt(y) ? 1 : -1
    if (isNumericX !== isNumericY) return isNumericX ? -1 : 1
    return x > y ? 1 : -1
  }
  return 0
}

export function validateRelease(manifest, lock, event) {
  assert.equal(manifest.name, packageName, 'Unexpected package name')
  const { identifiers } = parseVersion(manifest.version)
  for (const entry of [lock, lock.packages?.['']]) {
    assert.ok(entry, 'Lockfile must contain root package metadata')
    assert.equal(entry.name, manifest.name, 'Lockfile package name mismatch')
    assert.equal(entry.version, manifest.version, 'Lockfile version mismatch')
  }
  assert.equal(
    event.action,
    'published',
    'Only published release events are supported',
  )
  assert.equal(event.release?.draft, false, 'Draft releases cannot publish')
  assert.equal(
    event.release?.tag_name,
    `v${manifest.version}`,
    'Release tag must be v + package version',
  )
  assert.equal(
    event.release?.prerelease,
    identifiers.length > 0,
    'GitHub prerelease flag must match the version suffix',
  )
  return identifiers.length > 0 ? 'next' : 'latest'
}

export function verifyIntegrity(bytes, distribution) {
  // Prefer SRI; support legacy registries that expose only a SHA-1 shasum.
  const integrity = distribution?.integrity
  if (integrity) {
    const entries = integrity.split(/\s+/)
    const algorithm = ['sha512', 'sha384', 'sha256', 'sha1'].find((candidate) =>
      entries.some((entry) => entry.startsWith(`${candidate}-`)),
    )
    assert.ok(algorithm, 'Registry has no supported integrity hash')
    const expected = `${algorithm}-${createHash(algorithm).update(bytes).digest('base64')}`
    assert.ok(
      entries.includes(expected),
      'Published version differs from the release tarball; do not overwrite it',
    )
  } else {
    assert.equal(
      typeof distribution?.shasum,
      'string',
      'Registry omitted integrity and shasum',
    )
    assert.equal(
      createHash('sha1').update(bytes).digest('hex'),
      distribution.shasum,
      'Published version differs from the release tarball; do not overwrite it',
    )
  }
}

export async function publicationPlan({
  manifest,
  bytes,
  registry,
  distributionTag,
  request = fetch,
}) {
  assert.equal(registry, npmRegistry, 'Only npm publication is supported')
  assert.equal(
    distributionTag,
    parseVersion(manifest.version).identifiers.length > 0 ? 'next' : 'latest',
    'Incorrect distribution tag',
  )
  assert.equal(manifest.name, packageName, 'Unexpected package name')
  const response = await request(
    new URL(encodeURIComponent(manifest.name), registry),
    {
      headers: {},
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    },
  )
  // This package already exists on npm. A 404 may hide an auth
  // failure, so it is never permission to publish. Other failures also stop.
  assert.equal(
    response.status,
    200,
    `Cannot verify registry metadata (HTTP ${response.status}); publication stopped`,
  )
  const metadata = await response.json()
  assert.equal(
    metadata.name,
    manifest.name,
    'Registry returned another package',
  )
  assert.ok(
    metadata.versions &&
      typeof metadata.versions === 'object' &&
      !Array.isArray(metadata.versions),
    'Registry omitted version inventory',
  )
  assert.ok(
    metadata['dist-tags'] &&
      typeof metadata['dist-tags'] === 'object' &&
      !Array.isArray(metadata['dist-tags']),
    'Registry omitted distribution tags',
  )
  const existing = metadata.versions[manifest.version]
  if (Object.hasOwn(metadata.versions, manifest.version)) {
    assert.ok(
      existing && typeof existing === 'object',
      'Registry returned invalid version metadata',
    )
    assert.equal(
      existing.name,
      manifest.name,
      'Published package name mismatch',
    )
    assert.equal(
      existing.version,
      manifest.version,
      'Published version mismatch',
    )
    verifyIntegrity(bytes, existing.dist)
    return 'skip'
  }
  const current = metadata['dist-tags'][distributionTag]
  assert.ok(
    current === undefined || compareVersions(manifest.version, current) >= 0,
    `Refusing to move ${distributionTag} backwards from ${current}; historical versions must not change release tags`,
  )
  return 'publish'
}

async function main() {
  const [command, registry, archive, distributionTag, ...extra] =
    process.argv.slice(2)
  const manifest = JSON.parse(readFileSync('package.json', 'utf8'))
  const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'))
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const expectedTag = validateRelease(manifest, lock, event)
  if (command === 'validate') {
    assert.ok(!registry, 'Unexpected arguments')
    console.log(
      `Validated ${event.release.tag_name}; distribution tag: ${expectedTag}`,
    )
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `dist-tag=${expectedTag}\n`)
    return
  }
  assert.ok(
    command === 'publish' || command === 'verify',
    'Use validate, verify, or publish',
  )
  assert.equal(extra.length, 0, 'Unexpected arguments')
  assert.equal(distributionTag, expectedTag, 'Distribution tag mismatch')
  const archivePath = path.resolve(archive)
  verifyArchive(archivePath)
  const packed = JSON.parse(
    execFileSync('tar', ['-xOzf', archivePath, 'package/package.json'], {
      encoding: 'utf8',
      timeout: 10_000,
    }),
  )
  assert.deepEqual(
    packed,
    manifest,
    'Tarball manifest differs from the validated checkout',
  )
  const plan = await publicationPlan({
    manifest,
    bytes: readFileSync(archivePath),
    registry,
    distributionTag,
  })
  console.log(
    `${registry}: ${plan} ${manifest.name}@${manifest.version} (${distributionTag})`,
  )
  if (command === 'verify' || plan === 'skip') return
  assert.equal(
    process.env.GITHUB_ACTIONS,
    'true',
    'Publication is restricted to GitHub Actions',
  )
  const arguments_ = [
    'publish',
    archivePath,
    '--ignore-scripts',
    '--registry',
    registry,
    '--tag',
    distributionTag,
    '--access',
    'public',
  ]
  execFileSync('npm', arguments_, { stdio: 'inherit', timeout: 120_000 })
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}
