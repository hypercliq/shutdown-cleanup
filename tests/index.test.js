import { assert, expect } from 'chai'
import { spawn } from 'node:child_process'
import path from 'node:path'
import url from 'node:url'
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

import * as os from 'node:os'

let testScriptPath

const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit']

// list every signal that is available on the current platform
const nodejsSignals = Object.keys(process.binding('constants').os.signals)

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
testScriptPath = path.join(__dirname, 'test-script.js')

function spawnChildAndSetupListeners(
  arguments_,
  done,
  stdoutExpectation,
  stderrExpectation,
  exitCodeExpectation,
  debug = false,
) {
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
    debug ? console.log(data.toString()) : stdoutExpectation(data)
  })

  child.stderr.on('data', (data) => {
    debug ? console.error(data.toString()) : stderrExpectation(data)
  })

  child.on('error', (error) => {
    assert.fail(error)
  })

  child.on('exit', (code, signal) => {
    expect(code).to.equal(exitCodeExpectation)
    // eslint-disable-next-line unicorn/no-null
    expect(signal).to.equal(null)
    done()
  })
}

describe('Shutdown-cleanup module', function () {
  describe('Default signals', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    for (const testSignal of defaultSignals) {
      it(`should handle default signal ${testSignal} correctly`, function (done) {
        spawnChildAndSetupListeners(
          ['--default', testSignal],
          done,
          (data) => assert.fail('Should not have received any output: ' + data),
          (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled default signal: ${testSignal}`,
            ),
          testSignal === 'exit' ? 0 : os.constants.signals[testSignal],
        )
      })
    }
  })

  describe('Node lifecycle events', function () {
    it('should handle unhandledRejection correctly', function (done) {
      spawnChildAndSetupListeners(
        ['-l', 'unhandled'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) =>
          expect(data.toString().trim()).to.equal(
            'Handler for unhandledRejection: Error: Unhandled rejection',
          ),
        1,
      )
    })

    it('should handle beforeExit correctly', function (done) {
      spawnChildAndSetupListeners(
        ['-l', 'beforeExit'],
        done,
        (data) =>
          expect(data.toString().trim()).to.equal('Handler for beforeExit: 0'),
        (data) => assert.fail('Should not have received any error: ' + data),
        0,
      )
    })

    it('should handle uncaughtException correctly', function (done) {
      spawnChildAndSetupListeners(
        ['-l', 'uncaught'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) =>
          expect(data.toString().trim()).to.equal(
            'Handler for uncaughtException: Error: Uncaught exception',
          ),
        1,
      )
    })
  })

  describe('Signals and handlers', function () {
    it('should add and remove a signal', function () {
      const signal = 'SIGUSR2'
      const addResult = addSignal(signal)
      expect(addResult).to.be.true
      expect(listSignals()).to.include(signal)
      const removeResult = removeSignal(signal)
      expect(removeResult).to.be.true
      expect(listSignals()).to.not.include(signal)
    })

    it('should add and remove a signal handler', function () {
      const signal = 'SIGUSR2'
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const handler = (signal) => console.log(`Handled signal: ${signal}`)
      registerSignalHandler(signal, handler, true)
      const handlers = listHandlers()
      expect(handlers).to.include(handler)
      const removeResult = removeSignalHandler(signal)
      expect(removeResult).to.be.true
      expect(listHandlers()).to.not.include(handler)
    })

    it('should register, list and remove a generic handler', function () {
      // eslint-disable-next-line unicorn/consistent-function-scoping
      const handler = (signal) => console.log(`Handled signal: ${signal}`)
      const identifier = 'test'
      registerHandler(handler, identifier)
      const handlers = listHandlers()
      expect(handlers['1']).to.have.property(identifier) // Check if the '1' phase includes the identifier
      const removed = removeHandler(identifier)
      expect(removed).to.be.true
      expect(listHandlers()['1']).to.not.have.property(identifier) // Check if the '1' phase does not include the identifier after removal
    })
  })

  describe('POSIX signal handling', function () {
    // eslint-disable-next-line mocha/no-setup-in-describe
    for (const testSignal of nodejsSignals) {
      it(`should handle POSIX signal ${testSignal} correctly`, function (done) {
        spawnChildAndSetupListeners(
          ['-s', testSignal],
          done,
          (data) => assert.fail('Should not have received any output: ' + data),
          (data) =>
            expect(data.toString().trim()).to.equal(
              `Handled signal: ${testSignal}`,
            ),
          testSignal === 'SIGSTOP' || testSignal === 'SIGKILL'
            ? 1
            : os.constants.signals[testSignal],
        )
      })
    }
  })

  describe('Error handling strategy', function () {
    it('should error on invalid strategy', function (done) {
      spawnChildAndSetupListeners(
        ['-e', 'invalid'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) => assert.fail('Should not have received any error: ' + data),
        1,
      )
    })

    it('should handle continue strategy correctly', function (done) {
      spawnChildAndSetupListeners(
        ['-e', 'continue'],
        done,
        (data) =>
          expect(data.toString().trim()).to.equal('Handler for succeed'),
        (data) =>
          expect(data.toString().trim())
            .to.be.a('string')
            .and.satisfy((string_) =>
              string_.startsWith("Error in shutdown handler 'failingHandler"),
            ),
        0,
      )
    })

    it('should handle stop strategy correctly', function (done) {
      const stderrOutput = []
      spawnChildAndSetupListeners(
        ['-e', 'stop'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) => stderrOutput.push(data.toString().trim()),
        1,
      )
    })
  })

  describe('Custom exit code', function () {
    it('should set a custom exit code', function (done) {
      spawnChildAndSetupListeners(
        ['-x', '42'],
        done,
        (data) => expect(data.toString().trim()).to.equal('Handler for exit'),
        (data) => assert.fail('Should not have received any output: ' + data),
        42,
      )
    })
  })

  describe('Shutdown timeout', function () {
    it('should set a custom shutdown timeout', function (done) {
      spawnChildAndSetupListeners(
        ['-t', '100'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) =>
          expect(data.toString().trim()).to.equal(
            'Shutdown process timed out. Forcing exit.',
          ),
        1,
      )
    })
  })

  describe('Handle custom events', function () {
    it('should handle custom events correctly', function (done) {
      spawnChildAndSetupListeners(
        ['-c', 'customShutdownEvent', '100'],
        done,
        (data) => assert.fail('Should not have received any output: ' + data),
        (data) =>
          expect(data.toString().trim()).to.equal(
            'Handled signal: customShutdownEvent',
          ),
        100,
      )
    })
  })

  describe('Handle multi-phase handlers', function () {
    it('should handle multi-phase handlers correctly', function (done) {
      const stderrOutput = []
      spawnChildAndSetupListeners(
        ['--multi-phase'],
        done,
        (data) =>
          assert.fail(
            'Should not have received any output: ' + data.toString(),
          ),
        (data) => stderrOutput.push(data.toString().trim()),
        0,
      )
    })
  })
})
