import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const projectDirectory = fileURLToPath(new URL('../', import.meta.url))
const { values, positionals } = parseArgs({
  options: { 'runtime-only': { type: 'boolean', default: false } },
  allowPositionals: true,
})
assert.ok(positionals.length <= 1, 'Supply at most one archive')
const tarball = positionals[0]
const consumerDirectory = mkdtempSync(
  path.join(tmpdir(), 'shutdown-cleanup-consumer-'),
)
const npm = (arguments_, options = {}) =>
  execFileSync(process.execPath, [process.env.npm_execpath, ...arguments_], {
    cwd: consumerDirectory,
    stdio: 'inherit',
    timeout: 120_000,
    killSignal: 'SIGKILL',
    ...options,
  })

try {
  let archive
  if (tarball) {
    archive = path.resolve(tarball)
  } else {
    const [{ filename }] = JSON.parse(
      npm(
        [
          'pack',
          '--ignore-scripts',
          '--foreground-scripts=false',
          '--json',
          '--pack-destination',
          consumerDirectory,
        ],
        {
          cwd: projectDirectory,
          encoding: 'utf8',
          stdio: 'pipe',
          // Older npm 10 still runs prepare despite --ignore-scripts.
          env: { ...process.env, HUSKY: '0' },
        },
      ),
    )
    archive = path.join(consumerDirectory, filename)
  }
  writeFileSync(
    path.join(consumerDirectory, 'package.json'),
    JSON.stringify({ private: true, type: 'module' }),
  )
  npm([
    'install',
    archive,
    '--omit=dev',
    '--ignore-scripts',
    '--engine-strict',
    '--no-audit',
    '--no-fund',
    '--package-lock=false',
  ])
  if (values['runtime-only']) {
    cpSync(
      path.join(projectDirectory, 'tests'),
      path.join(consumerDirectory, 'tests'),
      { recursive: true },
    )
    execFileSync(
      process.execPath,
      [
        '--test',
        '--test-reporter=spec',
        'tests/index.test.js',
        'tests/subprocess.test.js',
        'tests/signals.test.js',
      ],
      {
        cwd: consumerDirectory,
        stdio: 'inherit',
        timeout: 600_000,
        killSignal: 'SIGKILL',
      },
    )
  } else {
    const expectedFiles = [
      'LICENSE',
      'README.md',
      'index.d.ts',
      'index.js',
      'package.json',
    ].toSorted((left, right) => left.localeCompare(right))
    const archiveFiles = execFileSync('tar', ['-tzf', archive], {
      encoding: 'utf8',
      timeout: 10_000,
      killSignal: 'SIGKILL',
    })
      .trim()
      .split('\n')
      .toSorted((left, right) => left.localeCompare(right))
    assert.deepStrictEqual(
      archiveFiles,
      expectedFiles
        .map((file) => `package/${file}`)
        .toSorted((left, right) => left.localeCompare(right)),
      'The archive must exclude tests, coverage, scratch files and development configuration',
    )

    // Run only inside the consumer, using the installed package's public name.
    writeFileSync(
      path.join(consumerDirectory, 'smoke.js'),
      `import assert from 'node:assert/strict'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import * as api from '@hypercliq/shutdown-cleanup'
import {
  addSignal, listHandlers, listSignals, registerHandler, removeHandler,
  removeSignal, setCustomExitCode, setErrorHandlingStrategy, setShutdownTimeout,
} from '@hypercliq/shutdown-cleanup'

assert.deepStrictEqual(Object.keys(api).toSorted((left, right) => left.localeCompare(right)), [
  'addSignal', 'listHandlers', 'listSignals', 'registerHandler', 'removeHandler',
  'removeSignal', 'setCustomExitCode', 'setErrorHandlingStrategy', 'setShutdownTimeout',
].toSorted((left, right) => left.localeCompare(right)))
for (const value of Object.values(api)) assert.equal(typeof value, 'function')
assert.equal(import.meta.resolve('@hypercliq/shutdown-cleanup'),
  new URL('./node_modules/@hypercliq/shutdown-cleanup/index.js', import.meta.url).href)
assert.equal(addSignal('smoke-unused'), true)
assert.equal(removeSignal('smoke-unused'), true)
assert.ok(listSignals().includes('SIGTERM'))
const removed = registerHandler(() => assert.fail('removed handler ran'))
assert.equal(removeHandler(removed), true)
setShutdownTimeout(2000)
setErrorHandlingStrategy('stop')
setCustomExitCode(23)
registerHandler((signal) => {
  assert.equal(signal, 'app:shutdown')
  console.log('phase 2')
}, { phase: 2 })
registerHandler(async (signal) => {
  assert.equal(signal, 'app:shutdown')
  await delay(20)
  console.log('phase 1 complete')
})
assert.equal(listHandlers().length, 2)
addSignal('app:shutdown')
process.emit('app:shutdown', 'app:shutdown')
setTimeout(() => assert.fail('shutdown did not terminate'), 3000)
`,
    )
    const child = spawnSync(process.execPath, ['smoke.js'], {
      cwd: consumerDirectory,
      encoding: 'utf8',
      timeout: 5000,
      killSignal: 'SIGKILL',
      env: { ...process.env, DEBUG: '', NODE_PATH: '' },
    })
    assert.ifError(child.error)
    assert.equal(child.signal, null) // eslint-disable-line unicorn/no-null
    assert.equal(
      child.status,
      23,
      `Unexpected shutdown result: ${child.stderr}`,
    )
    assert.equal(child.stderr, '')
    assert.equal(child.stdout, 'phase 1 complete\nphase 2\n')

    // The compiler and Node ambient types are tooling; package resolution stays
    // in the isolated consumer, without paths/baseUrl or repository self-reference.
    copyFileSync(
      path.join(projectDirectory, 'tests/types.ts'),
      path.join(consumerDirectory, 'types.ts'),
    )
    writeFileSync(
      path.join(consumerDirectory, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'NodeNext',
          moduleResolution: 'NodeNext',
          target: 'ESNext',
          strict: true,
          noEmit: true,
          skipLibCheck: false,
          types: ['node'],
          typeRoots: [path.join(projectDirectory, 'node_modules/@types')],
        },
        files: ['types.ts'],
      }),
    )
    execFileSync(
      process.execPath,
      [
        path.join(projectDirectory, 'node_modules/typescript/bin/tsc'),
        '-p',
        '.',
      ],
      {
        cwd: consumerDirectory,
        stdio: 'inherit',
        timeout: 30_000,
        killSignal: 'SIGKILL',
      },
    )
    console.log(
      'Package validation passed: five archive files, ESM exports, declarations and shutdown smoke check',
    )
  }
} finally {
  rmSync(consumerDirectory, { recursive: true, force: true })
}
