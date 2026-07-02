import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'
import os from 'node:os'
import process from 'node:process'

const nodejsSignals = Object.keys(os.constants.signals).filter(
  (signal) => !['SIGKILL', 'SIGSTOP'].includes(signal),
)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const testScriptPath = path.join(__dirname, 'test-script.js')

const spawnChildAndSetupListeners = ({
  arguments_,
  stdoutExpectation,
  stderrExpectation,
  exitCodeExpectation,
  debug = false,
}) =>
  new Promise((resolve, reject) => {
    const child = spawn(
      'node',
      [testScriptPath, ...arguments_],
      debug ? { env: { ...process.env, DEBUG: 'shutdown-cleanup' } } : {},
    )

    child.stdout.on('data', (chunk) => {
      if (debug) {
        console.log(chunk.toString())
      } else {
        try {
          stdoutExpectation(chunk)
        } catch (error) {
          reject(error)
        }
      }
    })

    child.stderr.on('data', (chunk) => {
      if (debug) {
        console.error(chunk.toString())
      } else {
        try {
          stderrExpectation(chunk)
        } catch (error) {
          reject(error)
        }
      }
    })

    child.once('error', reject)

    child.once('exit', (code, signal) => {
      try {
        assert.strictEqual(code, exitCodeExpectation)
        assert.strictEqual(signal, null) // eslint-disable-line unicorn/no-null
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })

describe('Shutdown-cleanup module', () => {
  describe('Handler Registration', () => {
    it('should register, list and remove a handler', () => {
      const identifier = 'testSync'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier],
        stdoutExpectation: (chunk) => {
          const data = JSON.parse(chunk.toString())
          assert.strictEqual(data.identifier, identifier)
          assert.strictEqual(data.listBefore.length, 1)
          assert.strictEqual(data.listBefore[0].phaseKey, 1)
          assert.ok('handlers' in data.listBefore[0])
          assert.strictEqual(data.listBefore[0].handlers.length, 1)
          assert.strictEqual(
            data.listBefore[0].handlers[0].identifier,
            identifier,
          )
          assert.strictEqual(data.listBefore[0].handlers[0].type, 'phase')
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.length, 0)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    it('should register, list and remove a signal handler', () => {
      const identifier = 'testAsync'
      const signal = 'SIGUSR2'
      return spawnChildAndSetupListeners({
        arguments_: [
          '--register-handler',
          'remove-it',
          identifier,
          signal,
          true,
        ],
        stdoutExpectation: (chunk) => {
          const data = JSON.parse(chunk.toString())
          assert.strictEqual(data.identifier, identifier)
          assert.strictEqual(data.listBefore.length, 1)
          assert.strictEqual(data.listBefore[0].phaseKey, 'signal')
          assert.ok('handlers' in data.listBefore[0])
          assert.strictEqual(data.listBefore[0].handlers.length, 1)
          assert.strictEqual(
            data.listBefore[0].handlers[0].identifier,
            identifier,
          )
          assert.strictEqual(data.listBefore[0].handlers[0].type, 'signal')
          assert.strictEqual(data.signalsBefore, true)
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.length, 0)
          assert.strictEqual(data.signalsAfter, false)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    it('should register, list and remove a signal handler for a default signal', () => {
      const identifier = 'testDefaultSignal'
      const signal = 'SIGINT'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier, signal],
        stdoutExpectation: (chunk) => {
          const data = JSON.parse(chunk.toString())
          assert.strictEqual(data.identifier, identifier)
          assert.strictEqual(data.listBefore.length, 1)
          assert.strictEqual(data.listBefore[0].phaseKey, 'signal')
          assert.ok('handlers' in data.listBefore[0])
          assert.strictEqual(data.listBefore[0].handlers.length, 1)
          assert.strictEqual(
            data.listBefore[0].handlers[0].identifier,
            identifier,
          )
          assert.strictEqual(data.listBefore[0].handlers[0].type, 'signal')
          assert.strictEqual(data.signalsBefore, true)
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.length, 0)
          assert.strictEqual(data.signalsAfter, true)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    it('should error when registering a handler with both signal and phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-signal-and-phase'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Cannot specify both "signal" and "phase"/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with an invalid phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-invalid-phase'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Phase must be a positive integer greater than 0/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with a fractional phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-invalid-phase', 'fractional'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Phase must be a positive integer greater than 0/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with a duplicate identifier', () => {
      const identifier = 'duplicateHandler'
      return spawnChildAndSetupListeners({
        arguments_: [
          '--register-handler',
          'with-duplicate-identifier',
          identifier,
        ],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            new RegExp(
              `Handler with identifier '${identifier}' already exists`,
            ),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler for an uncatchable signal', () => {
      const signal = 'SIGKILL'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-uncatchable-signal', signal],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            new RegExp(`Cannot handle uncatchable signal '${signal}'`),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should return false when removing a non-existent handler', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-non-existent'],
        stdoutExpectation: (chunk) => {
          const result = JSON.parse(chunk.toString())
          assert.strictEqual(result.removed, false)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Default signal handling', () => {
    const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'beforeExit']

    it('should have the default signals registered', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--list-default-signals'],
        stdoutExpectation: (chunk) => {
          const signals = JSON.parse(chunk.toString())
          assert.strictEqual(signals.length, defaultSignals.length)
          for (const signal of defaultSignals) {
            assert.ok(signals.includes(signal))
          }
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    for (const testSignal of defaultSignals) {
      it(`should handle default signal ${testSignal} correctly`, () => {
        return spawnChildAndSetupListeners({
          arguments_: ['--handle-default-signal', testSignal],
          stdoutExpectation: (chunk) =>
            assert.strictEqual(
              chunk.toString().trim(),
              `Handled default signal: ${testSignal}`,
            ),
          stderrExpectation: (chunk) =>
            assert.fail('Should not have received any error: ' + chunk),
          exitCodeExpectation:
            testSignal === 'beforeExit' ? 0 : os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('POSIX signal handling', () => {
    for (const testSignal of nodejsSignals) {
      it(`should handle POSIX signal ${testSignal} correctly`, () => {
        return spawnChildAndSetupListeners({
          arguments_: ['--handle-posix-signal', testSignal],
          stdoutExpectation: (chunk) =>
            assert.strictEqual(
              chunk.toString().trim(),
              `Handled signal: ${testSignal}`,
            ),
          stderrExpectation: (chunk) =>
            assert.fail('Should not have received any error: ' + chunk),
          exitCodeExpectation: os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('Node lifecycle events', () => {
    it('should handle unhandledRejection correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'unhandled'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            'Handler for unhandledRejection: Error: Unhandled rejection',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle beforeExit correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'beforeExit'],
        stdoutExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            'Handler for beforeExit: 0',
          ),
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    it('should handle uncaughtException correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'uncaught'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            'Handler for uncaughtException: Error: Uncaught exception',
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Custom signals and events', () => {
    it('should add and remove a signal', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', 'SIGUSR2'],
        stdoutExpectation: (chunk) => {
          const data = JSON.parse(chunk.toString())
          assert.strictEqual(data.added, true)
          assert.ok(data.listBefore.includes('SIGUSR2'))
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.includes('SIGUSR2'), false)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })

    it('should not add an uncatchable signal', () => {
      const uncatchableSignal = 'SIGKILL'
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', uncatchableSignal],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            new RegExp(
              `Cannot handle uncatchable signal '${uncatchableSignal}'`,
            ),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should not add a signal twice', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', 'SIGUSR2', 'SIGUSR2'],
        stdoutExpectation: (chunk) => {
          const data = JSON.parse(chunk.toString())
          assert.strictEqual(data.added, true)
          assert.strictEqual(data.duplicate, false)
          assert.ok(data.listBefore.includes('SIGUSR2'))
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.includes('SIGUSR2'), false)
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Error handling strategy', () => {
    it('should error on invalid strategy', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'invalid'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /handling strategy must be either 'continue' or 'stop'/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle continue strategy correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'continue'],
        stdoutExpectation: (chunk) =>
          assert.strictEqual(chunk.toString().trim(), 'Handler for succeed'),
        stderrExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            "Error in shutdown handler 'failingHandler' for phase '1': Error: Something went wrong",
          ),
        exitCodeExpectation: 0,
      })
    })

    it('should terminate after a failing signal-specific handler with continue strategy', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'continue', 'signal-handler'],
        stdoutExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            'Handler after failed signal-specific handler',
          ),
        stderrExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            "Error in handler 'failingSignalHandler': Error: Something went wrong",
          ),
        exitCodeExpectation: os.constants.signals.SIGTERM,
      })
    })

    it('should handle stop strategy correctly', async () => {
      const stderrOutput = []
      await spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'stop'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) => {
          stderrOutput.push(chunk.toString().trim())
        },
        exitCodeExpectation: 1,
      })
      const stderr = stderrOutput.join('\n')
      assert.ok(
        stderr.includes(
          "Error in shutdown handler 'failingHandler' for phase '1': Error: Something went wrong",
        ),
      )
      assert.ok(
        stderr.includes('Stopping shutdown process due to error in handler.'),
      )
    })
  })

  describe('Custom exit code', () => {
    it('should set a custom exit code', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', '42'],
        stdoutExpectation: (chunk) =>
          assert.strictEqual(chunk.toString().trim(), 'Handler for exit'),
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        exitCodeExpectation: 42,
      })
    })

    it('should error when setting a non-numeric custom exit code', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', 'invalid'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Custom exit code must be a number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a string custom exit code', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', '42', 'raw'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Custom exit code must be a number and a safe integer/,
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Shutdown timeout', () => {
    it('should set a custom shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '1000'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            'Shutdown process timed out. Forcing exit.',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a negative shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '-1000'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a non-numeric shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', 'invalid'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a string shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '1000', 'raw'],
        stdoutExpectation: (chunk) =>
          assert.fail('Should not have received any output: ' + chunk),
        stderrExpectation: (chunk) =>
          assert.match(
            chunk.toString().trim(),
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Handle custom events', () => {
    it('should handle custom events correctly', () => {
      const customEvent = 'customShutdownEvent'
      const customEventCode = '100'
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-event', customEvent, customEventCode],
        stdoutExpectation: (chunk) =>
          assert.strictEqual(
            chunk.toString().trim(),
            `Handled signal: ${customEvent}`,
          ),
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: Number(customEventCode),
      })
    })
  })

  describe('Handle phase handlers', () => {
    it('should execute handlers in the correct phase order', async () => {
      const shutdownLog = []
      await spawnChildAndSetupListeners({
        arguments_: ['--phase-handling', 'multi-phase'],
        stdoutExpectation: (chunk) => {
          shutdownLog.push(...chunk.toString().trim().split('\n'))
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
      assert.deepStrictEqual(shutdownLog, [
        'Handler for phase 1',
        'Handler for phase 2',
        'Handler for phase 3',
        'Handler for phase 4',
      ])
    })

    it('should execute handlers in the same phase in registration order', async () => {
      const shutdownLog = []
      await spawnChildAndSetupListeners({
        arguments_: ['--phase-handling', 'same-phase'],
        stdoutExpectation: (chunk) => {
          shutdownLog.push(...chunk.toString().trim().split('\n'))
        },
        stderrExpectation: (chunk) =>
          assert.fail('Should not have received any error: ' + chunk),
        exitCodeExpectation: 0,
      })
      assert.deepStrictEqual(shutdownLog, [
        'First handler in phase 1',
        'Second handler in phase 1',
      ])
    })
  })
})
