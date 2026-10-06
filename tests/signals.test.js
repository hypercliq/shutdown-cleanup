import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { describe, it } from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { runSubprocess } from './subprocess-helper.js'

const execute = promisify(execFile)
const fixture = fileURLToPath(new URL('signal-fixture.js', import.meta.url))
const nativeHarness = fileURLToPath(
  new URL('windows-console.ps1', import.meta.url),
)
const isWindows = process.platform === 'win32'
const isPosix = ['linux', 'darwin'].includes(process.platform)
const posixSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGUSR2']
const phases = (signal) => [
  'ready',
  `phase-1-start:${signal}`,
  `phase-1-end:${signal}`,
  `phase-2:${signal}`,
]
const specific = (signal) => [
  'ready',
  `signal-start:${signal}`,
  `signal-end:${signal}`,
  ...phases(signal).slice(1),
]
const journalLines = async (journal) => {
  const content = await readFile(journal, 'utf8')
  return content.trim().split('\n')
}
const withJournal = async (run) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'shutdown-signals-'))
  try {
    await run(path.join(directory, 'journal.txt'))
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
const waitForOccurrences = async (journal, line, count) => {
  for (let attempt = 0; attempt < 500; attempt++) {
    const entries = await journalLines(journal)
    if (entries.filter((entry) => entry === line).length >= count) return
    await delay(10)
  }
  assert.fail(`Missing ${count} occurrences of ${line}`)
}

const runPosix = (signal, mode, expected, expectations = {}, onReady) =>
  withJournal(async (journal) => {
    await runSubprocess({
      arguments_: [fixture, signal, mode, journal],
      onReady: onReady
        ? (child) => onReady(child, journal)
        : (child) => assert.ok(child.kill(signal)),
      exitCodeExpectation: os.constants.signals[signal],
      ...expectations,
    })
    assert.deepStrictEqual(await journalLines(journal), expected)
  })

const runWindows = (signal, mode, action, expected, code, arguments_ = []) =>
  withJournal(async (journal) => {
    const result = await execute(
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        nativeHarness,
        '-Node',
        process.execPath,
        '-Fixture',
        fixture,
        '-Journal',
        journal,
        '-Signal',
        signal,
        '-Mode',
        mode,
        '-Action',
        action,
        ...arguments_,
      ],
      { timeout: 45_000, windowsHide: true },
    )
    assert.equal(result.stderr, '')
    assert.equal(JSON.parse(result.stdout.trim()).code, code)
    assert.deepStrictEqual(await journalLines(journal), expected)
  })

describe('Genuine OS signal integration (no process.emit)', () => {
  describe(
    'Linux/macOS kill delivery',
    {
      skip: !isPosix && 'Requires Linux or macOS native signal delivery.',
    },
    () => {
      for (const signal of posixSignals) {
        const modes =
          signal === 'SIGUSR2'
            ? ['added', 'specific']
            : ['default', 'specific', 'restored']
        for (const mode of modes) {
          it(`${signal}: ${mode}, awaited ordered cleanup and signal exit code`, () =>
            runPosix(
              signal,
              mode,
              mode === 'specific' ? specific(signal) : phases(signal),
            ))
        }
      }
      it('uses a custom exit code after real SIGTERM', () =>
        runPosix('SIGTERM', 'custom-exit', phases('SIGTERM'), {
          exitCodeExpectation: 42,
        }))
      it('bounds a hanging signal-specific handler', () =>
        runPosix('SIGTERM', 'timeout', ['ready', 'signal-start:SIGTERM'], {
          exitCodeExpectation: 1,
          stderrExpectation: (output) =>
            assert.equal(
              output.toString(),
              'Shutdown process timed out. Forcing exit.\n',
            ),
        }))
      it('keeps a real non-terminating SIGINT handler repeatable', () =>
        runPosix(
          'SIGINT',
          'repeat',
          [
            'ready',
            'signal-start:SIGINT',
            'signal-end:SIGINT',
            'signal-start:SIGINT',
            'signal-end:SIGINT',
            ...phases('SIGTERM').slice(1),
          ],
          { exitCodeExpectation: os.constants.signals.SIGTERM },
          async (child, journal) => {
            for (const count of [1, 2]) {
              assert.ok(child.kill('SIGINT'))
              await waitForOccurrences(journal, 'signal-end:SIGINT', count)
            }
            assert.ok(child.kill('SIGTERM'))
          },
        ))
      it('SIGKILL bypasses all cleanup', () =>
        runPosix('SIGKILL', 'forced', ['ready'], {
          exitCodeExpectation: null, // eslint-disable-line unicorn/no-null
          exitSignalExpectation: 'SIGKILL',
        }))
      it('SIGKILL interrupts cleanup already running', () =>
        runPosix(
          'SIGTERM',
          'interrupted',
          ['ready', 'signal-start:SIGTERM'],
          {
            exitCodeExpectation: null, // eslint-disable-line unicorn/no-null
            exitSignalExpectation: 'SIGKILL',
          },
          async (child, journal) => {
            assert.ok(child.kill('SIGTERM'))
            await waitForOccurrences(journal, 'signal-start:SIGTERM', 1)
            assert.ok(child.kill('SIGKILL'))
          },
        ))
    },
  )

  describe(
    'Windows native console and termination',
    {
      skip: !isWindows && 'Requires Windows console APIs and PowerShell.',
    },
    () => {
      const interruptCases = [
        ['default', phases('SIGINT'), os.constants.signals.SIGINT],
        ['specific', specific('SIGINT'), os.constants.signals.SIGINT],
        ['restored', phases('SIGINT'), os.constants.signals.SIGINT],
        ['custom-exit', phases('SIGINT'), 42],
        ['timeout', ['ready', 'signal-start:SIGINT'], 1],
        ['interrupted', ['ready', 'signal-start:SIGINT'], 99],
        [
          'repeat',
          [
            'ready',
            'signal-start:SIGINT',
            'signal-end:SIGINT',
            'signal-start:SIGINT',
            'signal-end:SIGINT',
          ],
          99,
        ],
      ]
      for (const [mode, expected, code] of interruptCases) {
        it(`CTRL_C_EVENT / SIGINT: ${mode}`, () =>
          runWindows('SIGINT', mode, 'control', expected, code))
      }
      it('CTRL_C_EVENT / SIGINT: clears the inherited Ctrl+C-ignore attribute', () =>
        runWindows(
          'SIGINT',
          'default',
          'control',
          phases('SIGINT'),
          os.constants.signals.SIGINT,
          ['-IgnoredCtrlC'],
        ))
      for (const mode of ['added', 'specific']) {
        it(`CTRL_BREAK_EVENT / SIGBREAK: ${mode} (opt-in)`, () =>
          runWindows(
            'SIGBREAK',
            mode,
            'control',
            mode === 'specific' ? specific('SIGBREAK') : phases('SIGBREAK'),
            os.constants.signals.SIGBREAK,
          ))
      }
      it('WM_CLOSE / SIGHUP: short async cleanup within the OS deadline', () =>
        runWindows(
          'SIGHUP',
          'default',
          'close',
          phases('SIGHUP'),
          os.constants.signals.SIGHUP,
        ))
      it('TerminateProcess bypasses all cleanup', () =>
        runWindows('SIGTERM', 'forced', 'terminate', ['ready'], 99))
      for (const signal of ['SIGTERM', 'SIGINT', 'SIGKILL']) {
        it(`process.kill(${signal}) forcibly terminates without cleanup`, () =>
          withJournal(async (journal) => {
            await runSubprocess({
              arguments_: [fixture, signal, 'forced', journal],
              onReady: (child) => assert.ok(process.kill(child.pid, signal)),
              exitCodeExpectation: 1,
            })
            assert.deepStrictEqual(await journalLines(journal), ['ready'])
          }))
      }
      it('taskkill /F bypasses all cleanup', () =>
        withJournal(async (journal) => {
          await runSubprocess({
            arguments_: [fixture, 'SIGTERM', 'forced', journal],
            onReady: (child) =>
              execute('taskkill.exe', ['/PID', String(child.pid), '/F']),
            exitCodeExpectation: 1,
          })
          assert.deepStrictEqual(await journalLines(journal), ['ready'])
        }))
    },
  )

  it('explicit process.exit bypasses beforeExit cleanup on every platform', () =>
    withJournal(async (journal) => {
      await runSubprocess({
        arguments_: [fixture, 'beforeExit', 'explicit-exit', journal],
        exitCodeExpectation: 23,
      })
      assert.deepStrictEqual(await journalLines(journal), ['ready'])
    }))
})
