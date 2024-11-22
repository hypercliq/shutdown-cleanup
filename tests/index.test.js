import { spawn } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'
import os from 'node:os'
import process from 'node:process'
import { assert, expect } from 'chai'

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
      debug
        ? {
            env: {
              ...process.env,
              DEBUG: 'shutdown-cleanup',
            },
          }
        : {},
    )

    child.stdout.on('data', (data) => {
      if (debug) {
        console.log(data.toString())
      } else {
        try {
          stdoutExpectation(data)
        } catch (error) {
          reject(error)
        }
      }
    })

    child.stderr.on('data', (data) => {
      if (debug) {
        console.error(data.toString())
      } else {
        try {
          stderrExpectation(data)
        } catch (error) {
          reject(error)
        }
      }
    })

    child.once('error', (error) => {
      reject(error) // Fail the test if there's an error
    })

    child.once('exit', (code, signal) => {
      try {
        expect(code).to.equal(exitCodeExpectation)
        expect(signal).to.equal(null) // eslint-disable-line unicorn/no-null
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })

describe('Shutdown-cleanup module', function () {
  describe('Handler Registration', function () {
    it('should register, list and remove a handler', function () {
      const identifier = 'testSync'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier],
        stdoutExpectation: (data) => {
          data = JSON.parse(data.toString())
          expect(data.identifier).to.equal(identifier)
          expect(data.listBefore).to.have.lengthOf(1)
          expect(data.listBefore[0]).to.have.property('phaseKey', 1)
          expect(data.listBefore[0]).to.have.property('handlers')
          expect(data.listBefore[0].handlers).to.have.lengthOf(1)
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'identifier',
            identifier,
          )
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'type',
            'phase',
          )
          expect(data.removed).to.equal(true)
          expect(data.listAfter).to.have.lengthOf(0)
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should register, list and remove a signal handler', function () {
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
        stdoutExpectation: (data) => {
          data = JSON.parse(data.toString())
          expect(data.identifier).to.equal(identifier)
          expect(data.listBefore).to.have.lengthOf(1)
          expect(data.listBefore[0]).to.have.property('phaseKey', 'signal')
          expect(data.listBefore[0]).to.have.property('handlers')
          expect(data.listBefore[0].handlers).to.have.lengthOf(1)
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'identifier',
            identifier,
          )
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'type',
            'signal',
          )
          expect(data.signalsBefore).to.equal(true)
          expect(data.removed).to.equal(true)
          expect(data.listAfter).to.have.lengthOf(0)
          // SIGUSR2 should not be anywhere in the listened signals
          expect(data.signalsAfter).to.equal(false)
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should register, list and remove a signal handler for a default signal', function () {
      const identifier = 'testDefaultSignal'
      const signal = 'SIGINT'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-it', identifier, signal],
        stdoutExpectation: (data) => {
          data = JSON.parse(data.toString())
          expect(data.identifier).to.equal(identifier)
          expect(data.listBefore).to.have.lengthOf(1)
          expect(data.listBefore[0]).to.have.property('phaseKey', 'signal')
          expect(data.listBefore[0]).to.have.property('handlers')
          expect(data.listBefore[0].handlers).to.have.lengthOf(1)
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'identifier',
            identifier,
          )
          expect(data.listBefore[0].handlers[0]).to.have.property(
            'type',
            'signal',
          )
          expect(data.signalsBefore).to.equal(true)
          expect(data.removed).to.equal(true)
          expect(data.listAfter).to.have.lengthOf(0)
          // SIGINT is a default signal, so it should be re-added to the main listener
          expect(data.signalsAfter).to.equal(true)
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should error when registering a handler with both signal and phase', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-signal-and-phase'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /Cannot specify both "signal" and "phase"/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with an invalid phase', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-invalid-phase'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /Phase must be a positive integer greater than 0/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler with a duplicate identifier', function () {
      const identifier = 'duplicateHandler'
      return spawnChildAndSetupListeners({
        arguments_: [
          '--register-handler',
          'with-duplicate-identifier',
          identifier,
        ],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            new RegExp(
              `Handler with identifier '${identifier}' already exists`,
            ),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when registering a handler for an uncatchable signal', function () {
      const signal = 'SIGKILL'
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'with-uncatchable-signal', signal],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            new RegExp(`Cannot handle uncatchable signal '${signal}'`),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should return false when removing a non-existent handler', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--register-handler', 'remove-non-existent'],
        stdoutExpectation: (data) => {
          const result = JSON.parse(data.toString())
          expect(result.removed).to.equal(false)
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Default signal handling', function () {
    const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'beforeExit']

    it('should have the default signals registered', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--list-default-signals'],
        stdoutExpectation: (data) => {
          const signals = JSON.parse(data.toString())
          expect(signals).to.have.lengthOf(defaultSignals.length)
          for (const signal of defaultSignals) {
            expect(signals).to.include(signal)
          }
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    for (const testSignal of defaultSignals) {
      it(`should handle default signal ${testSignal} correctly`, function () {
        return spawnChildAndSetupListeners({
          arguments_: ['--handle-default-signal', testSignal],
          stdoutExpectation: (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled default signal: ${testSignal}`,
            ),
          stderrExpectation: (data) =>
            assert.fail('Should not have received any error: ' + data),
          exitCodeExpectation:
            testSignal === 'beforeExit' ? 0 : os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('POSIX signal handling', function () {
    for (const testSignal of nodejsSignals) {
      it(`should handle POSIX signal ${testSignal} correctly`, function () {
        return spawnChildAndSetupListeners({
          arguments_: ['--handle-posix-signal', testSignal],
          stdoutExpectation: (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled signal: ${testSignal}`,
            ),
          stderrExpectation: (data) =>
            assert.fail('Should not have received any error: ' + data),
          exitCodeExpectation: os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('Node lifecycle events', function () {
    it('should handle unhandledRejection correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'unhandled'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            'Handler for unhandledRejection: Error: Unhandled rejection',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle beforeExit correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'beforeExit'],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal('Handler for beforeExit: 0'),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should handle uncaughtException correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--node-lifecycle', 'uncaught'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            'Handler for uncaughtException: Error: Uncaught exception',
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Custom signals and events', function () {
    it('should add and remove a signal', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', 'SIGUSR2'],
        stdoutExpectation: (data) => {
          data = JSON.parse(data.toString())
          expect(data.added).to.equal(true)
          expect(data.listBefore).to.include('SIGUSR2')
          expect(data.removed).to.equal(true)
          expect(data.listAfter).to.not.include('SIGUSR2')
        },
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should not add an uncatchable signal', function () {
      const uncatchableSignal = 'SIGKILL'
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', uncatchableSignal],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            new RegExp(
              `Cannot handle uncatchable signal '${uncatchableSignal}'`,
            ),
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should not add a signal twice', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--add-remove-signal', 'SIGUSR2', 'SIGUSR2'],
        stdoutExpectation: (data) => {
          data = JSON.parse(data.toString())
          expect(data.added).to.equal(true)
          expect(data.duplicate).to.equal(false)
          expect(data.listBefore).to.include('SIGUSR2')
          expect(data.removed).to.equal(true)
          expect(data.listAfter).to.not.include('SIGUSR2')
        },
        stderrExpectation: (data) => {
          assert.fail('Should not have received any error: ' + data)
        },
        exitCodeExpectation: 0,
      })
    })
  })

  describe('Error handling strategy', function () {
    it('should error on invalid strategy', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'invalid'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /handling strategy must be either 'continue' or 'stop'/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should handle continue strategy correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'continue'],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal('Handler for succeed'),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            "Error in shutdown handler 'failingHandler' for phase '1': Error: Something went wrong",
          ),
        exitCodeExpectation: 0,
      })
    })

    it('should handle stop strategy correctly', function () {
      const stderrOutput = []
      return spawnChildAndSetupListeners({
        arguments_: ['--strategy', 'stop'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) => stderrOutput.push(data.toString().trim()),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Custom exit code', function () {
    it('should set a custom exit code', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', '42'],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal('Handler for exit'),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        exitCodeExpectation: 42,
      })
    })

    it('should error when setting a non-numeric custom exit code', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-exit-code', 'invalid'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /Custom exit code must be a number/,
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Shutdown timeout', function () {
    it('should set a custom shutdown timeout', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '1000'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            'Shutdown process timed out. Forcing exit.',
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a negative shutdown timeout', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', '-1000'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })

    it('should error when setting a non-numeric shutdown timeout', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-timeout', 'invalid'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.match(
            /Shutdown timeout must be a positive number/,
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Handle custom events', function () {
    it('should handle custom events correctly', function () {
      const customEvent = 'customShutdownEvent'
      const customEventCode = '100'
      return spawnChildAndSetupListeners({
        arguments_: ['--custom-event', customEvent, customEventCode],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            `Handled signal: ${customEvent}`,
          ),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: Number(customEventCode),
      })
    })
  })

  describe('Handle phase handlers', function () {
    it('should execute handlers in the correct phase order', async function () {
      const shutdownLog = []
      await spawnChildAndSetupListeners({
        arguments_: ['--phase-handling', 'multi-phase'],
        stdoutExpectation: (data_1) => {
          shutdownLog.push(...data_1.toString().trim().split('\n'))
        },
        stderrExpectation: (data_3) =>
          assert.fail('Should not have received any error: ' + data_3),
        exitCodeExpectation: 0,
      })
      expect(shutdownLog).to.deep.equal([
        'Handler for phase 1',
        'Handler for phase 2',
        'Handler for phase 3',
        'Handler for phase 4',
      ])
    })

    it('should execute handlers in the same phase in registration order', async function () {
      const shutdownLog = []
      await spawnChildAndSetupListeners({
        arguments_: ['--phase-handling', 'same-phase'],
        stdoutExpectation: (data_1) =>
          shutdownLog.push(...data_1.toString().trim().split('\n')),
        stderrExpectation: (data_3) =>
          assert.fail('Should not have received any error: ' + data_3),
        exitCodeExpectation: 0,
      })
      expect(shutdownLog).to.deep.equal([
        'First handler in phase 1',
        'Second handler in phase 1',
      ])
    })
  })
})
