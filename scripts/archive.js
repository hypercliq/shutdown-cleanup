import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export function archiveDigest(archive) {
  return createHash('sha512').update(readFileSync(archive)).digest('hex')
}

export function verifyArchive(archive) {
  assert.equal(
    archiveDigest(archive),
    readFileSync(`${archive}.sha512`, 'utf8').trim(),
    'Archive differs from the package validated by the development toolchain',
  )
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const [command, archive, ...extra] = process.argv.slice(2)
  assert.ok(archive && extra.length === 0, 'Supply one archive')
  assert.ok(command === 'seal' || command === 'verify', 'Use seal or verify')
  if (command === 'seal') {
    writeFileSync(`${archive}.sha512`, `${archiveDigest(archive)}\n`)
  } else {
    verifyArchive(archive)
  }
}
