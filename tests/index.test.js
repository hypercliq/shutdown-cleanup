import { spawn } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'
import * as os from 'node:os'
import process from 'node:process'
import { assert, expect } from 'chai'
import {
  addSignal,
  listHandlers,
  listSignals,
  registerHandler,
  registerSignalHandler,
  removeHandler,
  removeSignal,
  removeSignalHandler,
} from '../index.js'

// Const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']

// List every signal that is available on the current platform
const nodejsSignals = Object.keys(os.constants.signals)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const testScriptPath = path.join(__dirname, 'test-script.js')

const genericHandler = async () => {}

const syncHandler = (signal) => {
  console.log(`Handled signal: ${signal}`)
}

const asyncHandler = async (signal) => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  console.log(`Handled signal: ${signal}`)
}

function spawnChildAndSetupListeners({
  arguments_,
  stdoutExpectation,
  stderrExpectation,
  exitCodeExpectation,
  debug = false,
}) {
  return new Promise((resolve, reject) => {
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

    let stdoutData = ''
    let stderrData = ''

    child.stdout.on('data', (data) => {
      if (debug) {
        console.log(data.toString())
      } else {
        stdoutData += data.toString()
      }
    })

    child.stderr.on('data', (data) => {
      if (debug) {
        console.error(data.toString())
      } else {
        stderrData += data.toString()
      }
    })

    child.once('error', (error) => {
      reject(error) // Fail the test if there's an error
    })

    child.once('exit', (code, signal) => {
      try {
        expect(code).to.equal(exitCodeExpectation)
        expect(signal).to.be.null

        // Pass collected data to expectations
        if (stdoutExpectation && stdoutData !== '') {
          stdoutExpectation(stdoutData)
        }
        if (stderrExpectation && stderrData !== '') {
          stderrExpectation(stderrData)
        }

        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
}

describe('Shutdown-cleanup module', function () {
  afterEach(function () {
    // Cleanup: Remove all registered handlers to prevent test interference
    const allHandlers = listHandlers()
    for (const phase in allHandlers) {
      if (Object.hasOwn(allHandlers, phase)) {
        const handlersInPhase = allHandlers[phase]
        for (const identifier in handlersInPhase) {
          if (Object.hasOwn(handlersInPhase, identifier)) {
            removeHandler(identifier)
          }
        }
      }
    }

    const allSignals = listSignals()
    for (const signal of allSignals) {
      removeSignal(signal)
    }
  })

  describe('Handler Registration', function () {
    it('should throw a TypeError when registering a synchronous handler', function () {
      expect(() => registerHandler(syncHandler, 'syncHandler')).to.throw(
        TypeError,
        'Handler must be an asynchronous function (returning a Promise)',
      )
    })

    it('should register, list and remove an asynchronous generic handler', function () {
      const identifier = 'testAsync'
      registerHandler(asyncHandler, identifier, 1)
      const handlers = listHandlers()
      expect(handlers['1']).to.have.property(identifier)
      const removed = removeHandler(identifier)
      expect(removed).to.equal(true)
      expect(listHandlers()['1']).to.not.have.property(identifier)
    })

    it('should prevent registering handlers with duplicate identifiers', function () {
      registerHandler(genericHandler, 'duplicateId', 1)

      expect(listHandlers()['1']).to.have.property('duplicateId')

      // Attempt to register a handler with the same identifier in the same phase
      expect(() => registerHandler(genericHandler, 'duplicateId', 1)).to.throw(
        Error,
        "Handler with identifier 'duplicateId' already exists globally",
      )

      // Attempt to register a handler with the same identifier in different phase
      expect(() => registerHandler(genericHandler, 'duplicateId', 2)).to.throw(
        Error,
        "Handler with identifier 'duplicateId' already exists globally",
      )

      // Cleanup
      removeHandler('duplicateId')
    })
  })

  describe('Default signal handling', function () {
    const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']

    it('should have the default signals registered', function () {
      expect(listSignals()).to.have.members(defaultSignals)
    })

    for (const testSignal of defaultSignals) {
      it(`should handle default signal ${testSignal} correctly`, function () {
        return spawnChildAndSetupListeners({
          arguments_: ['--default', testSignal],
          stdoutExpectation: (data) =>
            assert.fail('Should not have received any error: ' + data),
          stderrExpectation: (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled default signal: ${testSignal}`,
            ),
          exitCodeExpectation:
            testSignal === 'exit' ? 0 : os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('POSIX signal handling', function () {
    for (const testSignal of nodejsSignals) {
      it(`should handle POSIX signal ${testSignal} correctly`, function () {
        return spawnChildAndSetupListeners({
          arguments_: ['-s', testSignal],
          stdoutExpectation: (data) =>
            assert.fail('Should not have received any output: ' + data),
          stderrExpectation: (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled signal: ${testSignal}`,
            ),
          exitCodeExpectation:
            testSignal === 'SIGSTOP' || testSignal === 'SIGKILL'
              ? 1
              : os.constants.signals[testSignal],
        })
      })
    }
  })

  describe('Node lifecycle events', function () {
    it('should handle unhandledRejection correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-l', 'unhandled'],
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
        arguments_: ['-l', 'beforeExit'],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal('Handler for beforeExit: 0'),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 0,
      })
    })

    it('should handle uncaughtException correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-l', 'uncaught'],
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

  describe('Signals and handlers', function () {
    it('should add and remove a signal', function () {
      const signal = 'SIGUSR2'
      const addResult = addSignal(signal)
      expect(addResult).to.equal(true)
      expect(listSignals()).to.include(signal)
      const removeResult = removeSignal(signal)
      expect(removeResult).to.equal(true)
      expect(listSignals()).to.not.include(signal)
    })

    it('should add and remove a signal handler', function () {
      const signal = 'SIGUSR2'

      // Register the signal handler and capture the returned identifier
      const identifier = registerSignalHandler(signal, asyncHandler, true)

      // List all handlers
      const handlers = listHandlers()

      // Ensure the signal is registered
      expect(handlers).to.have.property(signal)

      // Access the handler using the captured identifier
      const signalHandlersMap = handlers[signal]
      expect(signalHandlersMap).to.be.instanceOf(Map)
      expect(signalHandlersMap.has(identifier)).to.be.true
      expect(signalHandlersMap.get(identifier).handler).to.equal(asyncHandler)

      // Remove the signal handler using the signal and identifier
      const removeResult = removeSignalHandler(signal, identifier)
      expect(removeResult).to.equal(true)

      // Ensure the signal is no longer registered if no other handlers exist
      expect(listHandlers()).to.not.have.property(signal)
    })

    it('should register, list and remove an asynchronous generic handler', function () {
      const identifier = 'testAsync'

      registerHandler(asyncHandler, identifier, 1)
      const handlers = listHandlers()
      expect(handlers['1']).to.have.property(identifier)
      const removed = removeHandler(identifier)
      expect(removed).to.equal(true)
      expect(listHandlers()['1']).to.not.have.property(identifier)
    })
  })

  describe('Error handling strategy', function () {
    it('should error on invalid strategy', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-e', 'invalid'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any error: ' + data),
        exitCodeExpectation: 1,
      })
    })

    it('should continue shutdown even if a handler fails when strategy is "continue"', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-e', 'continue'],
        stdoutExpectation: (data) => {
          expect(data.toString().trim()).to.equal('Handler for succeed')
        },
        stderrExpectation: (data) => {
          expect(data.toString().trim())
            .to.be.a('string')
            .and.to.equal(
              "Error in shutdown handler 'failingHandler' for phase '1': Error: Some error",
            )
        },
        exitCodeExpectation: 0,
      })
    })

    it('should handle stop strategy correctly', function () {
      const stderrOutput = []
      return spawnChildAndSetupListeners({
        arguments_: ['-e', 'stop'],
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
        arguments_: ['-x', '42'],
        stdoutExpectation: (data) =>
          expect(data.toString().trim()).to.equal('Handler for exit'),
        stderrExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        exitCodeExpectation: 42,
      })
    })
  })

  describe('Shutdown timeout', function () {
    it('should set a custom shutdown timeout', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-t', '1000'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            'Shutdown process timed out. Forcing exit.',
          ),
        exitCodeExpectation: 1,
      })
    })
  })

  describe('Handle custom events', function () {
    it('should handle custom events correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-c', 'customShutdownEvent', '100'],
        stdoutExpectation: (data) =>
          assert.fail('Should not have received any output: ' + data),
        stderrExpectation: (data) =>
          expect(data.toString().trim()).to.equal(
            'Handled signal: customShutdownEvent',
          ),
        exitCodeExpectation: 100,
      })
    })
  })

  describe('Handle multi-phase handlers', function () {
    it('should handle multi-phase handlers correctly', function () {
      const stderrOutput = []
      return spawnChildAndSetupListeners({
        arguments_: ['--multi-phase'],
        stdoutExpectation: (data) =>
          assert.fail(
            'Should not have received any output: ' + data.toString(),
          ),
        stderrExpectation: (data) => stderrOutput.push(data.toString().trim()),
        exitCodeExpectation: 0,
      })
    })

    it('should handle multi-phase handlers correctly in order', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['--multi-phase'],
        stdoutExpectation: (data) => {
          // Expect no output on stdout
          expect(data).to.equal('')
        },
        stderrExpectation: (data) => {
          const expectedOrder = ['Handler for phase 1', 'Handler for phase 2']
          const receivedOrder = data
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)

          expect(receivedOrder).to.eql(expectedOrder)
        },
        exitCodeExpectation: 0,
      })
    })
  })
})
