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

const syncHandler = (signal) => {
  console.log(`Handled signal: ${signal}`)
}

const asyncHandler = async (signal) => {
  await new Promise((resolve) => setTimeout(resolve, 200))
  console.log(`Handled signal: ${signal}`)
}

const handleExpectations = (data) => {
  expect(data.toString().trim()).to.equal('Handler for succeed')
}

const isValidString = (string_) =>
  string_.startsWith("Error in shutdown handler 'failingHandler")

const handleStderrExpectation = (data) => {
  expect(data.toString().trim()).to.be.a('string').and.satisfy(isValidString)
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

    child.stdout.once('data', (data) => {
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

    child.stderr.once('data', (data) => {
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
        // eslint-disable-next-line unicorn/no-null
        expect(signal).to.equal(null)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
}

describe('Shutdown-cleanup module', function () {
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

      registerSignalHandler(signal, asyncHandler, true)
      const handlers = listHandlers()
      expect(handlers).to.have.property(signal)
      expect(handlers[signal].handler).to.equal(asyncHandler)
      const removeResult = removeSignalHandler(signal)
      expect(removeResult).to.equal(true)
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

    it('should handle continue strategy correctly', function () {
      return spawnChildAndSetupListeners({
        arguments_: ['-e', 'continue'],
        stdoutExpectation: handleExpectations,
        stderrExpectation: handleStderrExpectation,
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
  })
})
