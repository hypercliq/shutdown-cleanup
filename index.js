import * as os from 'node:os';
import process from 'node:process';

// Debugging setup
const {DEBUG} = process.env;
const enabled = DEBUG && /shutdown-cleanup|^\*$/.test(DEBUG);
const logger = (...message) => {
	if (enabled) {
		console.debug('\uD83D\uDC1Eshutdown-cleanup', ...message);
	}
};

// Using an object to store handlers, with integers as keys
const handlers = {};
// Default error handling strategy: 'continue' or 'stop'
let errorHandlingStrategy = 'continue';

// Create a random identifier for the handler
const randomIdentifier = prefix =>
	prefix
		? `${prefix}-${Math.random().toString(36).slice(2, 9)}`
		: Math.random().toString(36).slice(2, 9);

// Registers a shutdown handler within a specified phase, with an identifier
const registerHandler = (
	handler,
	identifier = randomIdentifier(handler.name),
	phase = 1,
) => {
	const phaseKey = Number.parseInt(phase, 10);
	if (Number.isNaN(phaseKey) || phaseKey < 1) {
		throw new Error('Phase must be a positive integer');
	}

	handlers[phaseKey] ||= {};

	if (handlers[phaseKey][identifier]) {
		throw new Error(
			`Handler with identifier '${identifier}' already exists in phase '${phaseKey}'`,
		);
	}

	handlers[phaseKey][identifier] = handler;
	logger(
		`Handler registered for phase '${phaseKey}', identifier: '${identifier}'`,
	);
};

const removeHandler = identifier => {
	for (const phase in handlers) {
		if (handlers[phase][identifier]) {
			delete handlers[phase][identifier];
			logger(`Removed handler: ${identifier}`);
			return true;
		}
	}

	return false;
};

const signalHandlers = {};

const registerSignalHandler = (signal, handler, shouldTerminate = true) => {
	const listener = async () => {
		const customHandler = signalHandlers[signal];

		if (customHandler) {
			try {
				await customHandler.handler(signal);
			} catch (error) {
				console.error(`Error in handler for signal '${signal}': ${error}`);
			}

			// Conditionally proceed to shutdown
			if (customHandler.shouldTerminate) {
				await shutdown(signal);
			}
		} else if (shouldTerminate) {
			await shutdown(signal);
		} else {
			console.warn(`Unhandled signal: ${signal}`);
		}
	};

	// Directly register the signal without checking against the 'signals' set
	signalHandlers[signal] = {handler, shouldTerminate, listener};

	// Attach the listener
	process.on(signal, listener);
};

const removeSignalHandler = signal => {
	const handler = signalHandlers[signal];

	if (handler) {
		delete signalHandlers[signal];
		process.removeListener(signal, handler.listener);
		logger(`Removed signal handler: ${signal}`);
		return true;
	}

	return false;
};

// Sets the global error handling strategy
const setErrorHandlingStrategy = strategy => {
	if (!['continue', 'stop'].includes(strategy)) {
		throw new Error('handling strategy must be either \'continue\' or \'stop\'');
	}

	errorHandlingStrategy = strategy;
};

// List all registered handlers both generic and signal-specific
const listHandlers = () => ({...handlers, ...signalHandlers});

const signals = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'exit']);

const addSignal = signal => {
	if (signals.has(signal)) {
		logger(`Signal already added: ${signal}`);
		return false;
	}

	signals.add(signal);
	attachListener(signal);
	logger(`Added signal: ${signal}`);
	return true;
};

const removeSignal = signal => {
	if (signals.delete(signal)) {
		process.removeListener(signal, shutdown);
		logger(`Removed signal: ${signal}`);
		return true;
	}

	return false;
};

const listSignals = () => [...signals];

const DEFAULT_EXIT_CODE = 1;

const getExitCode = signal => {
	let code;
	if (typeof signal === 'number') {
		code = signal;
	} else if (signal instanceof Error) {
		code = signal.errno;
	} else {
		code = os.constants.signals[signal];
	}

	return code ?? DEFAULT_EXIT_CODE;
};

let isShuttingDown = false;
let shutdownTimeout = 30_000; // 30 seconds timeout for the shutdown process

// Function to set the shutdown timeout
const setShutdownTimeout = timeout => {
	if (typeof timeout !== 'number' || timeout < 0) {
		throw new Error('Shutdown timeout must be a positive number');
	}

	logger(`Shutdown timeout set to: ${timeout}`);
	shutdownTimeout = timeout;
};

let customExitCode; // Variable to store custom exit code

// Function to set a custom exit code
const setCustomExitCode = code => {
	if (typeof code !== 'number') {
		throw new TypeError('Custom exit code must be a number');
	}

	logger(`Custom exit code set to: ${code}`);
	customExitCode = code;
};

const shutdown = async signal => {
	if (isShuttingDown) {
		logger('Shutdown already in progress');
		return;
	}

	isShuttingDown = true;
	logger(`Shutting down on ${signal}`);

	const shutdownTimer = setTimeout(() => {
		console.warn('Shutdown process timed out. Forcing exit.');

		// eslint-disable-next-line unicorn/no-process-exit
		process.exit(customExitCode || 1); // Use custom exit code if timeout occurs
	}, shutdownTimeout);

	const sortedPhases = Object.keys(handlers)
		.map(Number)
		.sort((a, b) => a - b);

	for (const phase of sortedPhases) {
		for (const identifier of Object.keys(handlers[phase])) {
			try {
				// eslint-disable-next-line no-await-in-loop
				await handlers[phase][identifier](signal);
			} catch (error) {
				console.error(
					`Error in shutdown handler '${identifier}' for phase '${phase}': ${error}`,
				);
				if (errorHandlingStrategy === 'stop') {
					console.error('Stopping shutdown process due to error in handler.');
					clearTimeout(shutdownTimer);

					// eslint-disable-next-line unicorn/no-process-exit
					process.exit(customExitCode || 1); // Use custom exit code if error occurs
				}
			}
		}
	}

	clearTimeout(shutdownTimer);
	logger('Shutdown completed');
	const exitCode = customExitCode || getExitCode(signal);
	logger(`Shutdown exitCode: ${exitCode}`);

	// eslint-disable-next-line unicorn/no-process-exit
	process.exit(exitCode);
};

const attachListener = signal => process.on(signal, shutdown);
for (const signal of signals) {
	attachListener(signal);
}

export {
	addSignal,
	listHandlers,
	listSignals,
	registerHandler,
	registerSignalHandler,
	removeHandler,
	removeSignal,
	removeSignalHandler,
	setCustomExitCode,
	setErrorHandlingStrategy,
	setShutdownTimeout,
};
