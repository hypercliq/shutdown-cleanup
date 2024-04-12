# _Developer Guide_

This developer guide provides in-depth documentation on how to use the `shutdown-cleanup` module effectively in your Node.js applications, covering best practices, detailed examples, and advanced usage scenarios.

## Default Signal Handling and Customization

By default, the module listens to common signals (`SIGINT`, `SIGTERM`, `SIGHUP`, and `exit`) to initiate the shutdown process. The module can also be customized to listen to additional signals or react to events.

Customize this behavior as needed:

### Adding and Removing Signals

Customize your application's response to system signals by adding or removing them:

```js
addSignal("beforeExit");
removeSignal("SIGHUP");
```

### Signal-Specific Handlers

Gain flexibility by registering handlers for specific signals or events, allowing for custom logic without necessitating a shutdown:

```js
registerSignalHandler(
  "SIGUSR1",
  async (signal) => {
    console.log("Custom logic for SIGUSR1");
  },
  false, // <= false indicates that the application should not terminate
);
```

## Handler Functions: Best Practices

Prefer asynchronous functions for handlers to ensure non-blocking operations and efficient shutdowns.

### Asynchronous Handlers

Asynchronous handlers prevent delays in the shutdown process, especially beneficial for I/O operations or lengthy tasks:

```javascript
registerHandler(async (signal) => {
  await performComplexCleanup();
  console.log("Cleanup completed");
}, "complexCleanup");
```

### Synchronous Handlers

While synchronous handlers are supported, use them cautiously for simple, quick tasks to avoid blocking the event loop:

```javascript
registerHandler(() => {
  performQuickCleanup();
  console.log("Quick cleanup done");
}, "quickCleanup");
```

## Advanced Configuration

- **Error Handling Strategies:** Should an error occur in a handler, choose between continuing with remaining handlers after the error (`'continue'`) or stopping the processing of handlers altogether (`'stop'`) with `setErrorHandlingStrategy`.
- **Shutdown Timeout:** Set a timeout for the shutdown process with `setShutdownTimeout`, ensuring the application doesn't hang indefinitely. This applies to asynchronous handlers only. Synchronous handlers might highjack the event loop and prevent the timeout from triggering.

## Examples

### Basic Shutdown Sequence

A simple setup for managing a graceful shutdown:

```javascript
import { registerHandler } from "@hypercliq/shutdown-cleanup";

registerHandler(async () => console.log("Cleanup resources"));
```

### Advanced Shutdown Sequence

A comprehensive example demonstrating how to set up a phased graceful shutdown sequence with
custom signal handling:

```js
// Import functions from shutdown-cleanup
import {
  addSignal,
  registerHandler,
  registerSignalHandler,
  setErrorHandlingStrategy,
  setCustomExitCode,
} from "@hypercliq/shutdown-cleanup";

// Register a phased shutdown handler which will be executed in the default (first) phase
registerHandler(
  async () => console.log("Phase 1: Release resources"),
  "releaseResources", // <= Specify a unique name for the handler
);

// Register a phased shutdown handler which will be executed in the second phase
registerHandler(
  async () => console.log("Phase 2: Close connections"),
  "closeConnections",
  2, // <= Specify the phase number
);

// Add extra lifecycle event to listen to, phased shutdown handlers will be executed for this event!
addSignal("beforeExit");

// Register a signal-specific handler for SIGUSR1
registerSignalHandler(
  "SIGUSR1",
  async (signal) => {
    console.log(`Handling ${signal} for debugging purposes`);
  },
  false, // <= false indicates that the application should not terminate
);

// Register a signal-specific handler for a custom signal raised somewhere in the application
registerSignalHandler(
  "customSignal", // <= Custom signal or event name
  async (signal) => {
    console.log(`Handling custom signal: ${signal}`);
  },
  true, // <= true indicates that the application should terminate
);

// Set the error handling strategy
setErrorHandlingStrategy("continue");

// Set a custom exit code
setCustomExitCode(42);
```

## API

This section provides a detailed overview of the functions available in the `shutdown-cleanup` module, allowing for effective management of your application's shutdown process.

### `addSignal(signal: string): boolean`

Adds a new signal or event to the list of signals that will initiate the shutdown process.

```js
addSignal("SIGUSR1");
```

### `removeSignal(signal: string): boolean`

Removes a signal from the list, preventing it from initiating the shutdown process if received.

```js
removeSignal("SIGUSR1");
```

### `registerHandler(handler: (signal: string) => Promise<void>, identifier?: string, phase?: number): void`

Registers a shutdown handler that will be executed when the shutdown process begins. Handlers can be organized into phases. If no name is provided, the handler will be registered with a unique identifier. If no phase is specified, the handler will be executed in the default phase (1).

```js
registerHandler(
  async (signal) => {
    console.log(`Handling shutdown for signal: ${signal}`);
  },
  "databaseCleanup",
  3, // <= Phase number, 1 is highest priority (default is 1)
);
```

### `removeHandler(identifier: string): boolean`

Removes a previously registered handler by its identifier.

```js
removeHandler("databaseCleanup");
```

### `registerSignalHandler(signal: string, handler: (signal: string) => Promise<void>, shouldTerminate: boolean): void`

Registers a handler for a specific signal or event. This allows for custom logic to be executed without necessarily terminating the application.

```js
registerSignalHandler(
  "SIGUSR1",
  async (signal) => {
    console.log(`Custom logic for ${signal}`);
  },
  false, // <= false indicates that the application should not terminate (default is true).
);
```

### `removeSignalHandler(signal: string): boolean`

Removes a previously registered signal-specific handler.

```js
removeSignalHandler("SIGUSR1");
```

### `setErrorHandlingStrategy(strategy: 'continue' | 'stop'): void`

Sets the global error handling strategy for the shutdown process. If an error occurs in a handler, choose between continuing with remaining handlers after the error (`'continue'`) or stopping the processing of handlers altogether (`'stop'`).

```js
setErrorHandlingStrategy("continue");
```

### `setCustomExitCode(code: number): void`

Sets a custom exit code to be used when the application exits after the shutdown process is complete.

```js
setCustomExitCode(42);
```

### `listHandlers(): object`

Returns a list of all registered handlers, including both phased and signal-specific handlers.

```js
const allHandlers = listHandlers();
console.log(allHandlers);
```

### `listSignals(): string[]`

Provides a list of all signals and events that are currently being listened to by the module.

```js
const signals = listSignals();
console.log(signals);
```

### `setShutdownTimeout(timeout: number): void`

Specifies a timeout for the shutdown process. If the shutdown does not complete within this timeframe, the process is forcibly terminated. But only for asynchronous handlers. A synchronous handler will block the shutdown process until it completes.

```js
setShutdownTimeout(20000); // 20 seconds - default is 30 seconds
```

## Contributing to Shutdown-Cleanup

We encourage contributions! If you have suggestions, bug reports, or would like to contribute code, please submit issues or pull requests on GitHub. For major changes, start by opening an issue to discuss your ideas.

Thank you for using and contributing to the `shutdown-cleanup` module!

### How to Contribute

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Commit your changes
5. Push your changes to your fork
6. Open a pull request
7. Wait for review and merge
8. Celebrate your contribution!

Remember to add tests for your changes and ensure that all tests pass before submitting a pull request. Also lint your code using the provided configuration.
