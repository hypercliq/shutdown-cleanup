import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import url from 'node:url'
import os from 'node:os'
import { runSubprocess } from './subprocess-helper.js'

const nodejsSignals = Object.keys(os.constants.signals).filter(
  (signal) => !['SIGKILL', 'SIGSTOP'].includes(signal),
)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const testScriptPath = path.join(__dirname, 'test-script.js')

const spawnChildAndSetupListeners = ({ arguments_, ...expectations }) =>
  runSubprocess({
    ...expectations,
    arguments_: [testScriptPath, ...arguments_],
  })

const runShutdownScenario = (source, expectations = {}) =>
  runSubprocess({
    arguments_: [
      '--input-type=module',
      '--eval',
      `
        import process from 'node:process'
        import { setTimeout as delay } from 'node:timers/promises'
        import {
          addSignal,
          listHandlers,
          listSignals,
          registerHandler,
          removeHandler,
          setCustomExitCode,
          setErrorHandlingStrategy,
          setShutdownTimeout,
        } from ${JSON.stringify(new URL('../index.js', import.meta.url).href)}
        ${source}
      `,
    ],
    ...expectations,
  })

const runRegistrationValidationScenario = (source) =>
  runShutdownScenario(`
    import assert from 'node:assert/strict'

    const snapshot = () => ({
      handlers: listHandlers(),
      signals: listSignals(),
      allSignals: listSignals({ includeSignalHandlers: true }),
      listeners: process.eventNames().map(event => ({
        event,
        count: process.listenerCount(event),
        listeners: process.rawListeners(event),
      })),
    })
    const assertRejected = (handler, options, expectedError) => {
      const before = snapshot()
      assert.throws(() => registerHandler(handler, options), expectedError)
      assert.deepStrictEqual(snapshot(), before)
    }

    // Exercise validation with no groups and with both group types present.
    for (const populated of [false, true]) {
      if (populated) {
        registerHandler(() => {}, { identifier: 'existing-phase', phase: 2 })
        registerHandler(() => {}, {
          identifier: 'existing-signal', signal: 'SIGINT', shouldTerminate: false,
        })
      }
      ${source}
    }
  `)

const expectLines =
  (...lines) =>
  (output) =>
    assert.strictEqual(output.toString(), lines.join('\n') + '\n')

describe('Shutdown-cleanup module', () => {
  describe('Handler Registration', () => {
    it('should leave registry and listeners unchanged for invalid handlers', () =>
      runRegistrationValidationScenario(`
        for (const handler of [undefined, null, false, 1, 'handler', {}, [], Symbol('handler')]) {
          assertRejected(handler, { signal: 'SIGTERM' }, TypeError)
        }
      `))

    it('should leave registry and listeners unchanged for invalid phases', () =>
      runRegistrationValidationScenario(`
        for (const phase of [0, -1, 1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, '2', true, null, {}, [], Symbol('phase'), 1n]) {
          assertRejected(() => {}, { phase }, /Phase must be a positive integer greater than 0/)
        }
      `))

    it('should leave registry and listeners unchanged for uncatchable signals', () =>
      runRegistrationValidationScenario(`
        for (const signal of ['SIGKILL', 'SIGSTOP']) {
          assertRejected(() => {}, { signal }, /Cannot handle uncatchable signal/)
        }
      `))

    it('should leave registry and listeners unchanged for malformed options', () =>
      runRegistrationValidationScenario(`
        for (const options of [null, false, true, 0, 1, 'options', 1n, Symbol('options'), [], () => {}]) {
          assertRejected(() => {}, options, TypeError)
        }
        for (const signal of [null, false, true, 0, 1, NaN, {}, [], Symbol('signal')]) {
          assertRejected(() => {}, { signal }, TypeError)
        }
        for (const shouldTerminate of [null, 0, 1, 'false', {}, [], Symbol('terminate')]) {
          assertRejected(() => {}, { signal: 'SIGTERM', shouldTerminate }, TypeError)
        }
        for (const options of [
          { signal: 'SIGTERM', phase: 1 },
          { signal: '', phase: 1 },
          { signal: 'SIGTERM', phase: null },
        ]) {
          assertRejected(() => {}, options, /Cannot specify both "signal" and "phase"/)
        }
        for (const options of [{ shouldTerminate: false }, { phase: 2, shouldTerminate: true }]) {
          assertRejected(() => {}, options, /"shouldTerminate" requires "signal"/)
        }
      `))

    it('should reject non-string identifiers without changing registry or listeners', () =>
      runRegistrationValidationScenario(`
        for (const identifier of [null, false, true, 0, 42, 1n, Symbol('identifier'), {}, [], new String('identifier')]) {
          assertRejected(() => {}, { identifier }, TypeError)
          assertRejected(() => {}, { identifier, signal: 'SIGTERM' }, TypeError)
        }
      `))

    it('should reject duplicate identifiers across phases and signals without changing state', () =>
      runRegistrationValidationScenario(`
        registerHandler(() => {}, { identifier: 'duplicate-phase', phase: 3 })
        registerHandler(() => {}, {
          identifier: 'duplicate-signal', signal: 'duplicate-event', shouldTerminate: false,
        })
        for (const identifier of ['duplicate-phase', 'duplicate-signal']) {
          for (const options of [{ phase: 3 }, { phase: 4 }, { signal: 'SIGTERM' }, { signal: 'another-event' }]) {
            assertRejected(() => {}, { ...options, identifier }, /already exists/)
          }
        }
        removeHandler('duplicate-phase')
        removeHandler('duplicate-signal')
      `))

    it('should reject duplicate default signals and custom events without changing state', () =>
      runRegistrationValidationScenario(`
        for (const signal of ['SIGTERM', 'duplicate-event', '']) {
          const identifier = registerHandler(() => {}, { signal, shouldTerminate: false })
          assertRejected(() => {}, { signal }, /already has a handler/)
          assertRejected(() => {}, { signal, shouldTerminate: false }, /already has a handler/)
          assert.strictEqual(removeHandler(identifier), true)
        }
      `))

    it('should preserve supported JavaScript options and string identifiers', () =>
      runRegistrationValidationScenario(`
        const handler = () => {}
        for (const options of [
          undefined,
          {},
          { identifier: undefined, phase: undefined, signal: undefined, shouldTerminate: undefined },
          { identifier: '', phase: 3 },
          { phase: Number.MAX_SAFE_INTEGER },
          { phase: 4, extraOption: 'ignored' },
          Object.create({ identifier: 'inherited', phase: 5 }),
          Object.assign(Object.create(null), { identifier: 'null-prototype' }),
          new class { phase = 6 }(),
        ]) {
          const identifier = registerHandler(handler, options)
          assert.strictEqual(typeof identifier, 'string')
          if (options?.identifier !== undefined) {
            assert.strictEqual(identifier, options.identifier)
          } else {
            assert.match(identifier, /^handler_[0-9]+$/)
          }
          const group = listHandlers().find(group => group.phaseKey === (options?.phase ?? 1))
          assert.deepStrictEqual(group.handlers.find(entry => entry.identifier === identifier), {
            identifier, type: 'phase', handler,
          })
          assert.strictEqual(removeHandler(identifier), true)
        }
      `))

    it('should support string process events and restore replaced listeners', () =>
      runRegistrationValidationScenario(`
        for (const signal of ['SIGTERM', 'custom-event', 'SIGUNKNOWN', '']) {
          const externalListener = () => {}
          process.on(signal, externalListener)
          const before = process.rawListeners(signal)
          const calls = []
          const handler = value => { calls.push(value) }
          const identifier = registerHandler(handler, { signal, shouldTerminate: false })
          assert.strictEqual(process.listenerCount(signal), before.length + (signal === 'SIGTERM' ? 0 : 1))
          assert.ok(process.rawListeners(signal).includes(externalListener))
          assert.ok(!listSignals().includes(signal))
          assert.ok(listSignals({ includeSignalHandlers: true }).includes(signal))
          process.emit(signal, 'first')
          process.emit(signal, 'second')
          assert.deepStrictEqual(calls, ['first', 'second'])
          assert.strictEqual(removeHandler(identifier), true)
          assert.strictEqual(process.listenerCount(signal), before.length)
          for (const listener of before) {
            assert.ok(process.rawListeners(signal).includes(listener))
          }
          assert.strictEqual(listSignals().includes(signal), signal === 'SIGTERM')
          process.off(signal, externalListener)
        }
        for (const options of [
          { signal: 'termination-default' },
          { signal: 'termination-default', shouldTerminate: undefined },
          { signal: 'termination-default', shouldTerminate: true },
        ]) {
          const identifier = registerHandler(() => {}, options)
          const entry = listHandlers().find(group => group.phaseKey === 'signal').handlers.find(entry => entry.identifier === identifier)
          assert.strictEqual(entry.shouldTerminate, true)
          assert.strictEqual(removeHandler(identifier), true)
        }
      `))

    it('should leave registry and default listeners unchanged if attaching a listener fails', () =>
      runRegistrationValidationScenario(`
        const originalOn = process.on
        const attachmentError = new Error('Listener attachment failed')
        for (const signal of ['SIGTERM', 'failed-event']) {
          process.on = function (event, listener) {
            if (event === signal) throw attachmentError
            return originalOn.call(this, event, listener)
          }
          try {
            assertRejected(() => {}, { signal }, error => error === attachmentError)
          } finally {
            process.on = originalOn
          }
          // A subsequent successful registration and removal must still restore
          // the original default listener, without stale removed-signal state.
          const identifier = registerHandler(() => {}, { signal, shouldTerminate: false })
          assert.strictEqual(removeHandler(identifier), true)
          assert.strictEqual(listSignals().includes(signal), signal === 'SIGTERM')
        }
      `))

    it('should register, list and remove a handler', () => {
      const identifier = 'testSync'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier],
        stdoutExpectation: (output) => {
          const data = JSON.parse(output.toString())
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
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
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
        stdoutExpectation: (output) => {
          const data = JSON.parse(output.toString())
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
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })

    it('should register, list and remove a signal handler for a default signal', () => {
      const identifier = 'testDefaultSignal'
      const signal = 'SIGINT'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier, signal],
        stdoutExpectation: (output) => {
          const data = JSON.parse(output.toString())
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
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })

    it('should error when registering a handler with both signal and phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-signal-and-phase'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /Cannot specify both "signal" and "phase"/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with an invalid phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-invalid-phase'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /Phase must be a positive integer greater than 0/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with a fractional phase', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-invalid-phase', 'fractional'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
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
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
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
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            new RegExp(`Cannot handle uncatchable signal '${signal}'`),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should return false when removing a non-existent handler', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-non-existent'],
        stdoutExpectation: (output) => {
          const result = JSON.parse(output.toString())
          assert.strictEqual(result.removed, false)
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Default signal handling', () => {
    const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'beforeExit']

    it('should have the default signals registered', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--list-default-signals'],
        stdoutExpectation: (output) => {
          const signals = JSON.parse(output.toString())
          assert.strictEqual(signals.length, defaultSignals.length)
          for (const signal of defaultSignals) {
            assert.ok(signals.includes(signal))
          }
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })

    for (const testSignal of defaultSignals) {
      it(`should handle default signal ${testSignal} correctly`, () => {
        return spawnChildAndSetupListeners({
          arguments_: ['--handle-default-signal', testSignal],
          stdoutExpectation: (output) =>
            assert.strictEqual(
              output.toString().trim(),
              `Handled default signal: ${testSignal}`,
            ),
          stderrExpectation: (output) =>
            assert.strictEqual(output.toString(), ''),
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
          stdoutExpectation: (output) =>
            assert.strictEqual(
              output.toString().trim(),
              `Handled signal: ${testSignal}`,
            ),
          stderrExpectation: (output) =>
            assert.strictEqual(output.toString(), ''),
          exitCodeExpectation: os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('Node lifecycle events', () => {
    it('should handle unhandledRejection correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'unhandled'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            'Handler for unhandledRejection: Error: Unhandled rejection',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle beforeExit correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'beforeExit'],
        stdoutExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            'Handler for beforeExit: 0',
          ),
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })

    it('should handle uncaughtException correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'uncaught'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
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
        stdoutExpectation: (output) => {
          const data = JSON.parse(output.toString())
          assert.strictEqual(data.added, true)
          assert.ok(data.listBefore.includes('SIGUSR2'))
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.includes('SIGUSR2'), false)
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })

    it('should not add an uncatchable signal', () => {
      const uncatchableSignal = 'SIGKILL'
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', uncatchableSignal],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
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
        stdoutExpectation: (output) => {
          const data = JSON.parse(output.toString())
          assert.strictEqual(data.added, true)
          assert.strictEqual(data.duplicate, false)
          assert.ok(data.listBefore.includes('SIGUSR2'))
          assert.strictEqual(data.removed, true)
          assert.strictEqual(data.listAfter.includes('SIGUSR2'), false)
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Coordinated signal shutdown', () => {
    for (const signal of ['SIGTERM', 'beforeExit']) {
      for (const customExitCode of [undefined, 42]) {
        it(`times out a never-settling ${signal} handler with exit code ${customExitCode ?? 1}`, () =>
          runShutdownScenario(
            `
              setShutdownTimeout(50)
              ${customExitCode === undefined ? '' : `setCustomExitCode(${customExitCode})`}
              registerHandler(() => {
                console.log('signal started')
                return new Promise(() => {})
              }, { signal: '${signal}' })
              registerHandler(() => console.log('unexpected phase'))
              ${signal === 'beforeExit' ? '' : `process.emit('${signal}', '${signal}')`}
            `,
            {
              stdoutExpectation: expectLines('signal started'),
              stderrExpectation: expectLines(
                'Shutdown process timed out. Forcing exit.',
              ),
              exitCodeExpectation: customExitCode ?? 1,
              timeoutMs: 2000,
            },
          ))
      }
    }

    it('uses one deadline for the signal handler and subsequent phases', () =>
      runShutdownScenario(
        `
          setShutdownTimeout(500)
          registerHandler(async () => {
            console.log('signal started')
            await delay(300)
            console.log('signal finished')
          }, { signal: 'SIGTERM', shouldTerminate: true })
          registerHandler(async () => {
            console.log('phase started')
            await delay(300)
            console.log('unexpected phase completion')
          })
          process.emit('SIGTERM', 'SIGTERM')
        `,
        {
          stdoutExpectation: expectLines(
            'signal started',
            'signal finished',
            'phase started',
          ),
          stderrExpectation: expectLines(
            'Shutdown process timed out. Forcing exit.',
          ),
          exitCodeExpectation: 1,
        },
      ))

    for (const competingEvent of [
      'SIGTERM',
      'SIGINT',
      'beforeExit',
      'app:other',
    ]) {
      it(`ignores competing ${competingEvent} during the signal handler and phases`, () =>
        runShutdownScenario(
          `
            let calls = 0
            const compete = () => process.emit('${competingEvent}', 99)
            registerHandler(async (value) => {
              console.log('signal started: ' + value)
              // Emit reentrantly as well as while the handler is suspended.
              if (++calls === 1) compete()
              await delay(20)
              console.log('signal finished: ' + value)
            }, { signal: 'SIGTERM' })
            registerHandler(() => console.log('unexpected other handler'), {
              signal: 'app:other', shouldTerminate: true,
            })
            registerHandler(async (value) => {
              console.log('phase 1: ' + value)
              compete()
              await delay(20)
            })
            registerHandler((value) => console.log('phase 2: ' + value), {
              phase: 2,
            })
            process.emit('SIGTERM', 'SIGTERM')
            compete()
          `,
          {
            stdoutExpectation: expectLines(
              'signal started: SIGTERM',
              'signal finished: SIGTERM',
              'phase 1: SIGTERM',
              'phase 2: SIGTERM',
            ),
            exitCodeExpectation: os.constants.signals.SIGTERM,
          },
        ))
    }

    it('ignores a terminating handler when a default signal starts shutdown first', () =>
      runShutdownScenario(
        `
          registerHandler(() => console.log('unexpected signal handler'), {
            signal: 'SIGTERM',
          })
          registerHandler(async (value) => {
            console.log('phase started: ' + value)
            process.emit('SIGTERM', 'SIGTERM')
            await delay(20)
            console.log('phase finished: ' + value)
          })
          process.emit('SIGINT', 'SIGINT')
          process.emit('SIGTERM', 'SIGTERM')
        `,
        {
          stdoutExpectation: expectLines(
            'phase started: SIGINT',
            'phase finished: SIGINT',
          ),
          exitCodeExpectation: os.constants.signals.SIGINT,
        },
      ))

    it('coordinates natural beforeExit with its handler and preserves the numeric exit code', () =>
      runShutdownScenario(
        `
          process.exitCode = 7
          registerHandler(async (value) => {
            console.log('beforeExit started: ' + value)
            process.emit('beforeExit', 99)
            process.emit('SIGTERM', 'SIGTERM')
            await delay(20)
            console.log('beforeExit finished: ' + value)
          }, { signal: 'beforeExit' })
          registerHandler((value) => console.log('phase: ' + value))
        `,
        {
          stdoutExpectation: expectLines(
            'beforeExit started: 7',
            'beforeExit finished: 7',
            'phase: 7',
          ),
          exitCodeExpectation: 7,
        },
      ))

    for (const strategy of ['continue', 'stop']) {
      for (const failure of ['throw', 'reject']) {
        for (const customExitCode of [undefined, 42]) {
          it(`handles a signal handler ${failure} with ${strategy} and ${customExitCode ?? 'default'} exit code`, () =>
            runShutdownScenario(
              `
                setShutdownTimeout(1000)
                setErrorHandlingStrategy('${strategy}')
                ${customExitCode === undefined ? '' : `setCustomExitCode(${customExitCode})`}
                registerHandler(${failure === 'reject' ? 'async' : ''} () => {
                  console.log('signal started')
                  ${failure === 'reject' ? 'await delay(20)' : ''}
                  throw new Error('cleanup failed')
                }, { signal: 'app:shutdown', identifier: 'failingSignal' })
                registerHandler((value) => console.log('phase 1: ' + value))
                registerHandler((value) => console.log('phase 2: ' + value), {
                  phase: 2,
                })
                process.emit('app:shutdown', 23)
              `,
              {
                stdoutExpectation: expectLines(
                  'signal started',
                  ...(strategy === 'continue'
                    ? ['phase 1: 23', 'phase 2: 23']
                    : []),
                ),
                stderrExpectation: expectLines(
                  "Error in handler 'failingSignal': Error: cleanup failed",
                  ...(strategy === 'stop'
                    ? ['Stopping shutdown process due to error in handler.']
                    : []),
                ),
                exitCodeExpectation:
                  customExitCode ?? (strategy === 'stop' ? 1 : 23),
              },
            ))
        }
      }
    }

    it('keeps non-terminating handlers repeatable and outside the shutdown deadline', () =>
      runShutdownScenario(
        `
          setShutdownTimeout(50)
          let calls = 0
          const pending = []
          registerHandler(() => {
            const call = ++calls
            console.log('repeat started: ' + call)
            const work = delay(100).then(() => console.log('repeat finished: ' + call))
            pending.push(work)
            return work
          }, { signal: 'SIGTERM', shouldTerminate: false })
          process.emit('SIGTERM', 'SIGTERM')
          process.emit('SIGTERM', 'SIGTERM')
          await Promise.all(pending)
          console.log('still running')
          setShutdownTimeout(1000)
          registerHandler(async () => {
            // Non-terminating handlers remain repeatable during shutdown too.
            process.emit('SIGTERM', 'SIGTERM')
            process.emit('SIGTERM', 'SIGTERM')
            await Promise.all(pending)
            console.log('phase finished')
          })
          addSignal('app:shutdown')
          process.emit('app:shutdown', 0, 'extra event argument')
        `,
        {
          stdoutExpectation: expectLines(
            'repeat started: 1',
            'repeat started: 2',
            'repeat finished: 1',
            'repeat finished: 2',
            'still running',
            'repeat started: 3',
            'repeat started: 4',
            'repeat finished: 3',
            'repeat finished: 4',
            'phase finished',
          ),
        },
      ))
  })

  describe('Handler mutations during shutdown', () => {
    it('skips a deleted future phase and continues to later phases', () =>
      runShutdownScenario(
        `
          registerHandler(() => {
            console.log('phase 1')
            console.log('removed: ' + removeHandler('pending'))
          })
          registerHandler(() => console.log('unexpected phase 2'), {
            identifier: 'pending', phase: 2,
          })
          registerHandler(() => console.log('phase 3'), { phase: 3 })
          process.emit('beforeExit', 0)
        `,
        {
          stdoutExpectation: expectLines('phase 1', 'removed: true', 'phase 3'),
        },
      ))

    it('removes a pending handler within the current phase', () =>
      runShutdownScenario(
        `
          registerHandler(async () => {
            console.log('first started')
            await delay(10)
            console.log('removed: ' + removeHandler('pending'))
            console.log('first finished')
          })
          registerHandler(() => console.log('unexpected pending handler'), {
            identifier: 'pending',
          })
          registerHandler(() => console.log('third'))
          registerHandler(() => console.log('phase 2'), { phase: 2 })
          process.emit('beforeExit', 0)
        `,
        {
          stdoutExpectation: expectLines(
            'first started',
            'removed: true',
            'first finished',
            'third',
            'phase 2',
          ),
        },
      ))

    it('honors removals from other work while a handler is suspended', () =>
      runShutdownScenario(
        `
          registerHandler(async () => {
            console.log('first started')
            queueMicrotask(() => {
              console.log('removed: ' + removeHandler('pending'))
            })
            await delay(10)
            console.log('first finished')
          })
          registerHandler(() => console.log('unexpected pending handler'), {
            identifier: 'pending',
          })
          registerHandler(() => console.log('last'))
          process.emit('beforeExit', 0)
        `,
        {
          stdoutExpectation: expectLines(
            'first started',
            'removed: true',
            'first finished',
            'last',
          ),
        },
      ))

    it('allows a sole handler to remove itself without cancelling its invocation', () =>
      runShutdownScenario(
        `
          registerHandler(async () => {
            console.log('removed: ' + removeHandler('self'))
            console.log('removed again: ' + removeHandler('self'))
            await delay(10)
            console.log('self finished')
          }, { identifier: 'self' })
          registerHandler(() => console.log('phase 2'), { phase: 2 })
          process.emit('beforeExit', 0)
        `,
        {
          stdoutExpectation: expectLines(
            'removed: true',
            'removed again: false',
            'self finished',
            'phase 2',
          ),
        },
      ))

    it('excludes registrations in completed, current, future and new phases', () =>
      runShutdownScenario(
        `
          registerHandler(() => console.log('phase 3 first'), { phase: 3 })
          registerHandler(() => console.log('phase 1'), { phase: 1 })
          registerHandler(async () => {
            console.log('phase 2 first')
            await delay(10)
            for (const phase of [1, 2, 3, 4]) {
              registerHandler(() => console.log('unexpected new phase ' + phase), {
                phase,
              })
            }
          }, { phase: 2 })
          registerHandler(() => console.log('phase 3 second'), { phase: 3 })
          registerHandler(() => console.log('phase 2 second'), { phase: 2 })
          process.emit('beforeExit', 0)
        `,
        {
          stdoutExpectation: expectLines(
            'phase 1',
            'phase 2 first',
            'phase 2 second',
            'phase 3 first',
            'phase 3 second',
          ),
        },
      ))

    for (const phase of [1, 2, 3]) {
      it(`excludes a replacement registration in phase ${phase} using the same identifier and function`, () =>
        runShutdownScenario(
          `
            const pending = () => console.log('unexpected replacement')
            registerHandler(() => {
              console.log('first')
              console.log('removed: ' + removeHandler('pending'))
              registerHandler(pending, { identifier: 'pending', phase: ${phase} })
            })
            registerHandler(pending, { identifier: 'pending', phase: ${phase} })
            registerHandler(() => console.log('last'), { phase: 3 })
            process.emit('beforeExit', 0)
          `,
          { stdoutExpectation: expectLines('first', 'removed: true', 'last') },
        ))
    }

    it('does not let self-registering cleanup extend shutdown', () =>
      runShutdownScenario(
        `
          const cleanup = () => {
            console.log('cleanup')
            registerHandler(cleanup)
          }
          registerHandler(cleanup)
          process.emit('beforeExit', 0)
        `,
        { stdoutExpectation: expectLines('cleanup'), timeoutMs: 2000 },
      ))

    for (const hasPendingPhase of [false, true]) {
      it(`snapshots before a terminating signal handler with ${hasPendingPhase ? 'pending phases' : 'no phases'}`, () =>
        runShutdownScenario(
          `
            registerHandler(async () => {
              console.log('signal started')
              await delay(10)
              ${hasPendingPhase ? "console.log('removed: ' + removeHandler('pending'))" : ''}
              registerHandler(() => console.log('unexpected new phase 1'))
              registerHandler(() => console.log('unexpected new phase 2'), { phase: 2 })
              console.log('signal finished')
            }, { signal: 'beforeExit' })
            ${
              hasPendingPhase
                ? `
              registerHandler(() => console.log('unexpected pending handler'), {
                identifier: 'pending',
              })
              registerHandler(() => console.log('phase 2'), { phase: 2 })
            `
                : ''
            }
            process.emit('beforeExit', 0)
          `,
          {
            stdoutExpectation: expectLines(
              'signal started',
              ...(hasPendingPhase ? ['removed: true'] : []),
              'signal finished',
              ...(hasPendingPhase ? ['phase 2'] : []),
            ),
          },
        ))
    }
  })

  describe('Error handling strategy', () => {
    it('should error on invalid strategy', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'invalid'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /handling strategy must be either 'continue' or 'stop'/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle continue strategy correctly', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'continue'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString().trim(), 'Handler for succeed'),
        stderrExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            "Error in shutdown handler 'failingHandler' for phase '1': Error: Something went wrong",
          ),
        exitCodeExpectation: 0,
      })
    })

    it('should terminate after a failing signal-specific handler with continue strategy', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'continue', 'signal-handler'],
        stdoutExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            'Handler after failed signal-specific handler',
          ),
        stderrExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            "Error in handler 'failingSignalHandler': Error: Something went wrong",
          ),
        exitCodeExpectation: os.constants.signals.SIGTERM,
      })
    })

    it('should handle stop strategy correctly', async () => {
      const stderrOutput = []
      await spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'stop'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) => {
          stderrOutput.push(output.toString().trim())
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
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString().trim(), 'Handler for exit'),
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 42,
      })
    })

    it('should error when setting a non-numeric custom exit code', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', 'invalid'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /Custom exit code must be a number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a string custom exit code', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', '42', 'raw'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
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
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            'Shutdown process timed out. Forcing exit.',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a negative shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '-1000'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a non-numeric shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', 'invalid'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a string shutdown timeout', () => {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '1000', 'raw'],
        stdoutExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        stderrExpectation: (output) =>
          assert.match(
            output.toString().trim(),
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
        stdoutExpectation: (output) =>
          assert.strictEqual(
            output.toString().trim(),
            `Handled signal: ${customEvent}`,
          ),
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: Number(customEventCode),
      })
    })
  })

  describe('Handle phase handlers', () => {
    it('should execute handlers in the correct phase order', async () => {
      const shutdownLog = []
      await spawnChildAndSetupListeners({
        arguments_: ['--phase-handling', 'multi-phase'],
        stdoutExpectation: (output) => {
          shutdownLog.push(...output.toString().trim().split('\n'))
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
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
        stdoutExpectation: (output) => {
          shutdownLog.push(...output.toString().trim().split('\n'))
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), ''),
        exitCodeExpectation: 0,
      })
      assert.deepStrictEqual(shutdownLog, [
        'First handler in phase 1',
        'Second handler in phase 1',
      ])
    })
  })
})
