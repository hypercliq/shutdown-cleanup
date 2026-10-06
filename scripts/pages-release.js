import assert from 'node:assert/strict'
import { appendFileSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateRelease } from './release.js'

// Publication time, rather than semver or the stable-only /releases/latest
// endpoint, orders documentation across both stable releases and prereleases.
export function isNewestPublishedRelease(release, releases) {
  assert.ok(Array.isArray(releases), 'GitHub omitted the release inventory')
  const published = releases.filter((entry) => {
    assert.equal(typeof entry?.draft, 'boolean', 'Invalid GitHub release')
    return !entry.draft
  })
  for (const entry of published) {
    assert.ok(Number.isSafeInteger(entry.id), 'Invalid GitHub release ID')
    assert.ok(
      typeof entry.published_at === 'string' &&
        Number.isFinite(Date.parse(entry.published_at)),
      'Invalid GitHub release publication time',
    )
  }
  const current = published.find((entry) => entry.id === release.id)
  assert.ok(
    current,
    'Current release is absent from GitHub; deployment stopped',
  )
  assert.equal(current.tag_name, release.tag_name, 'GitHub release tag changed')
  const newest = published.toSorted(
    (left, right) =>
      Date.parse(right.published_at) - Date.parse(left.published_at) ||
      right.id - left.id,
  )[0]
  return current.id === newest.id
}

export async function listReleases({ repository, token, request = fetch }) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/, 'Invalid GitHub repository')
  assert.ok(token, 'GitHub token is required')
  const releases = []
  for (let page = 1; ; page++) {
    const response = await request(
      `https://api.github.com/repos/${repository}/releases?per_page=100&page=${page}`,
      {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
        },
        redirect: 'error',
        signal: AbortSignal.timeout(30_000),
      },
    )
    assert.equal(
      response.status,
      200,
      `Cannot verify documentation freshness (HTTP ${response.status}); deployment stopped`,
    )
    const entries = await response.json()
    assert.ok(Array.isArray(entries), 'GitHub omitted the release inventory')
    releases.push(...entries)
    if (entries.length < 100) return releases
  }
}

async function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  validateRelease(
    JSON.parse(readFileSync('package.json', 'utf8')),
    JSON.parse(readFileSync('package-lock.json', 'utf8')),
    event,
  )
  const deploy = isNewestPublishedRelease(
    event.release,
    await listReleases({
      repository: process.env.GITHUB_REPOSITORY,
      token: process.env.GITHUB_TOKEN,
    }),
  )
  appendFileSync(process.env.GITHUB_OUTPUT, `deploy=${deploy}\n`)
  console.log(
    deploy
      ? `Documentation follows ${event.release.tag_name}`
      : `Skipping superseded documentation for ${event.release.tag_name}`,
  )
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}
