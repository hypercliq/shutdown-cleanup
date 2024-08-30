import {spawn} from 'node:child_process';
import path from 'node:path';
import url from 'node:url';
import * as os from 'node:os';
import process from 'node:process';
import {assert, expect} from 'chai';
import {
	addSignal,
	listHandlers,
	listSignals,
	registerHandler,
	registerSignalHandler,
	removeHandler,
	removeSignal,
	removeSignalHandler,
} from '../index.js';

const defaultSignals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'exit'];

// List every signal that is available on the current platform
const nodejsSignals = Object.keys(os.constants.signals);

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const testScriptPath = path.join(__dirname, 'test-script.js');

function spawnChildAndSetupListeners({
	arguments_,
	done,
	stdoutExpectation,
	stderrExpectation,
	exitCodeExpectation,
	debug = false,
}) {
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
	);

	child.stdout.on('data', data => {
		if (debug) {
			console.log(data.toString());
		} else {
			stdoutExpectation(data);
		}
	});

	child.stderr.on('data', data => {
		if (debug) {
			console.error(data.toString());
		} else {
			stderrExpectation(data);
		}
	});

	child.on('error', error => {
		assert.fail(error);
	});

	child.on('exit', (code, signal) => {
		expect(code).to.equal(exitCodeExpectation);

		expect(signal).to.equal(null);
		done();
	});
}

describe('Shutdown-cleanup module', () => {
	describe('Default signals', () => {
		for (const testSignal of defaultSignals) {
			it(`should handle default signal ${testSignal} correctly`, done => {
				spawnChildAndSetupListeners({
					arguments_: ['--default', testSignal],
					done,
					stdoutExpectation: data =>
						assert.fail('Should not have received any output: ' + data),
					stderrExpectation: data =>
						expect(data.toString().trim()).to.equal(
							`Handled default signal: ${testSignal}`,
						),
					exitCodeExpectation:
            testSignal === 'exit' ? 0 : os.constants.signals[testSignal],
				});
			});
		}
	});

	describe('Node lifecycle events', () => {
		it('should handle unhandledRejection correctly', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-l', 'unhandled'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data =>
					expect(data.toString().trim()).to.equal(
						'Handler for unhandledRejection: Error: Unhandled rejection',
					),
				exitCodeExpectation: 1,
			});
		});

		it('should handle beforeExit correctly', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-l', 'beforeExit'],
				done,
				stdoutExpectation: data =>
					expect(data.toString().trim()).to.equal('Handler for beforeExit: 0'),
				stderrExpectation: data =>
					assert.fail('Should not have received any error: ' + data),
				exitCodeExpectation: 0,
			});
		});

		it('should handle uncaughtException correctly', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-l', 'uncaught'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data =>
					expect(data.toString().trim()).to.equal(
						'Handler for uncaughtException: Error: Uncaught exception',
					),
				exitCodeExpectation: 1,
			});
		});
	});

	describe('Signals and handlers', () => {
		it('should add and remove a signal', () => {
			const signal = 'SIGUSR2';
			const addResult = addSignal(signal);
			expect(addResult).to.equal(true);
			expect(listSignals()).to.include(signal);
			const removeResult = removeSignal(signal);
			expect(removeResult).to.equal(true);
			expect(listSignals()).to.not.include(signal);
		});

		it('should add and remove a signal handler', () => {
			const signal = 'SIGUSR2';

			const handler = signal => console.log(`Handled signal: ${signal}`);
			registerSignalHandler(signal, handler, true);
			const handlers = listHandlers();
			expect(handlers).to.include(handler);
			const removeResult = removeSignalHandler(signal);
			expect(removeResult).to.equal(true);
			expect(listHandlers()).to.not.include(handler);
		});

		it('should register, list and remove a generic handler', () => {
			const handler = signal => console.log(`Handled signal: ${signal}`);
			const identifier = 'test';
			registerHandler(handler, identifier);
			const handlers = listHandlers();
			expect(handlers['1']).to.have.property(identifier); // Check if the '1' phase includes the identifier
			const removed = removeHandler(identifier);
			expect(removed).to.equal(true);
			expect(listHandlers()['1']).to.not.have.property(identifier); // Check if the '1' phase does not include the identifier after removal
		});
	});

	describe('POSIX signal handling', () => {
		for (const testSignal of nodejsSignals) {
			it(`should handle POSIX signal ${testSignal} correctly`, done => {
				spawnChildAndSetupListeners({
					arguments_: ['-s', testSignal],
					done,
					stdoutExpectation: data =>
						assert.fail('Should not have received any output: ' + data),
					stderrExpectation: data =>
						expect(data.toString().trim()).to.equal(
							`Handled signal: ${testSignal}`,
						),
					exitCodeExpectation:
            testSignal === 'SIGSTOP' || testSignal === 'SIGKILL' ? 1 : os.constants.signals[testSignal],
				});
			});
		}
	});

	describe('Error handling strategy', () => {
		it('should error on invalid strategy', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-e', 'invalid'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data =>
					assert.fail('Should not have received any error: ' + data),
				exitCodeExpectation: 1,
			});
		});

		it('should handle continue strategy correctly', done => {
			const handleExpectations = data => {
				expect(data.toString().trim()).to.equal('Handler for succeed');
			};

			const isValidString = string_ =>
				string_.startsWith('Error in shutdown handler \'failingHandler');

			const handleStderrExpectation = data => {
				expect(data.toString().trim())
					.to.be.a('string')
					.and.satisfy(isValidString);
			};

			spawnChildAndSetupListeners({
				arguments_: ['-e', 'continue'],
				done,
				stdoutExpectation: handleExpectations,
				stderrExpectation: handleStderrExpectation,
				exitCodeExpectation: 0,
			});
		});

		it('should handle stop strategy correctly', done => {
			const stderrOutput = [];
			spawnChildAndSetupListeners({
				arguments_: ['-e', 'stop'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data => stderrOutput.push(data.toString().trim()),
				exitCodeExpectation: 1,
			});
		});
	});

	describe('Custom exit code', () => {
		it('should set a custom exit code', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-x', '42'],
				done,
				stdoutExpectation: data =>
					expect(data.toString().trim()).to.equal('Handler for exit'),
				stderrExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				exitCodeExpectation: 42,
			});
		});
	});

	describe('Shutdown timeout', () => {
		it('should set a custom shutdown timeout', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-t', '100'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data =>
					expect(data.toString().trim()).to.equal(
						'Shutdown process timed out. Forcing exit.',
					),
				exitCodeExpectation: 1,
			});
		});
	});

	describe('Handle custom events', () => {
		it('should handle custom events correctly', done => {
			spawnChildAndSetupListeners({
				arguments_: ['-c', 'customShutdownEvent', '100'],
				done,
				stdoutExpectation: data =>
					assert.fail('Should not have received any output: ' + data),
				stderrExpectation: data =>
					expect(data.toString().trim()).to.equal(
						'Handled signal: customShutdownEvent',
					),
				exitCodeExpectation: 100,
			});
		});
	});

	describe('Handle multi-phase handlers', () => {
		it('should handle multi-phase handlers correctly', done => {
			const stderrOutput = [];
			spawnChildAndSetupListeners({
				arguments_: ['--multi-phase'],
				done,
				stdoutExpectation: data =>
					assert.fail(
						'Should not have received any output: ' + data.toString(),
					),
				stderrExpectation: data => stderrOutput.push(data.toString().trim()),
				exitCodeExpectation: 0,
			});
		});
	});
});
