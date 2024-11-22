# Developer Guide

This developer guide provides in-depth documentation on how to use the `shutdown-cleanup` module effectively in your Node.js applications, covering best practices, detailed examples, and advanced usage scenarios.

## Introduction

The `shutdown-cleanup` module offers a structured approach to gracefully handle shutdown processes in Node.js applications. It supports:

- **Phased Shutdowns**: Organize cleanup tasks into phases for orderly execution.
- **Signal-Specific Handlers**: Define custom logic for specific signals without mandatory shutdown.
- **Custom Error Handling**: Choose how the module handles errors in your handlers.
- **Custom Exit Codes**: Specify exit codes to indicate shutdown statuses.
- **Support for Both Synchronous and Asynchronous Handlers**: Flexibility in how you write your handlers.

## Default Signal Handling and Customization

By default, the module listens to common signals (`SIGINT`, `SIGTERM`, `SIGHUP`, and `beforeExit`) to initiate the shutdown process. You can customize this behavior as needed.

### Adding and Removing Signals

Customize your application's response to system signals by adding or removing them:

```js
import { addSignal, removeSignal } from '@hypercliq/shutdown-cleanup'

addSignal('SIGUSR1')
removeSignal('SIGHUP')
```

### Signal-Specific Handlers

Gain flexibility by registering handlers for specific signals or events, allowing for custom logic without necessitating a shutdown:

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(
  async (signal) => {
    console.log('Custom logic for SIGUSR1')
  },
  {
    signal: 'SIGUSR1',
    shouldTerminate: false, // false indicates that the application should not terminate
  },
)
```

## Handler Functions: Best Practices

**Both synchronous and asynchronous functions** are accepted as handlers. The module has taken careful steps to ensure that asynchronous handlers are handled properly, mitigating the potential issues warned about in the Node.js documentation.

### Handling Asynchronous Handlers Safely

#### Node.js Warning on Async Event Handlers

The Node.js documentation cautions against using `async` functions directly as event handlers because unhandled promise rejections can occur if errors are not properly caught. This can lead to warnings or even cause the process to crash in certain Node.js versions.

#### Our Module's Mitigation

The `shutdown-cleanup` module internally wraps the execution of your handlers to catch both synchronous exceptions and promise rejections. This ensures that even if your asynchronous handler throws an error or returns a rejected promise, the module will handle it appropriately, preventing unhandled promise rejections.

#### What This Means for You

- **You Can Safely Use Async Handlers**: Feel free to define your handlers as `async` functions. The module has you covered.
- **Error Handling**: It's still good practice to handle errors within your handlers, but the module provides an additional safety net.
- **Consistency**: Write your handlers in the way that makes the most sense for your application logic.

### Examples

**Asynchronous Handler:**

```javascript
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  await performAsyncCleanup()
  console.log('Asynchronous cleanup completed')
})
```

**Synchronous Handler:**

```javascript
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler((signal) => {
  performSyncCleanup()
  console.log('Synchronous cleanup completed')
})
```

### Best Practices for Handlers

- **Handle Errors Appropriately**: While the module catches unhandled rejections, it's best to handle errors within your handlers for clarity and to manage specific error scenarios.
- **Keep Handlers Efficient**: Ensure your handlers complete their tasks promptly to avoid delaying the shutdown process.
- **Avoid Blocking Operations**: Especially in synchronous handlers, avoid operations that might block the event loop for extended periods.

## Advanced Configuration

### Error Handling Strategies

Set how the module handles errors occurring in your handlers using `setErrorHandlingStrategy`:

- `'continue'` (default): Continues executing remaining handlers even if an error occurs.
- `'stop'`: Stops executing remaining handlers if an error occurs.

```js
import { setErrorHandlingStrategy } from '@hypercliq/shutdown-cleanup'

setErrorHandlingStrategy('stop')
```

### Shutdown Timeout

Set a timeout for the shutdown process with `setShutdownTimeout`, ensuring the application doesn't hang indefinitely:

```js
import { setShutdownTimeout } from '@hypercliq/shutdown-cleanup'

setShutdownTimeout(20000) // 20 seconds - default is 30 seconds
```

### Custom Exit Codes

Specify a custom exit code to be used when the application exits after the shutdown process:

```js
import { setCustomExitCode } from '@hypercliq/shutdown-cleanup'

setCustomExitCode(42)
```

## Examples

### Basic Shutdown Sequence

A simple setup for managing a graceful shutdown:

```javascript
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  await performAsyncCleanup()
  console.log('Cleanup resources')
})
```

### Advanced Shutdown Sequence

A comprehensive example demonstrating how to set up a phased graceful shutdown sequence with custom signal handling:

```js
import {
  addSignal,
  registerHandler,
  setErrorHandlingStrategy,
  setCustomExitCode,
} from '@hypercliq/shutdown-cleanup'

// Register a phased shutdown handler to be executed in the default phase (phase 1)
registerHandler(
  async (signal) => {
    await releaseResources()
    console.log('Phase 1: Release resources')
  },
  {
    identifier: 'releaseResources', // Specify a unique identifier for the handler
  },
)

// Register a handler to be executed in phase 2
registerHandler(
  async (signal) => {
    await closeConnections()
    console.log('Phase 2: Close connections')
  },
  {
    identifier: 'closeConnections',
    phase: 2, // Specify the phase number
  },
)

// Add an extra lifecycle event to listen to; phased shutdown handlers will be executed for this event
addSignal('beforeExit')

// Register a signal-specific handler for SIGUSR1 that does not terminate the application
registerHandler(
  async (signal) => {
    console.log(`Handling ${signal} for debugging purposes`)
  },
  {
    signal: 'SIGUSR1',
    shouldTerminate: false, // The application will not terminate after this handler
  },
)

// Register a signal-specific handler for a custom signal raised somewhere in the application
registerHandler(
  async (signal) => {
    console.log(`Handling custom signal: ${signal}`)
  },
  {
    signal: 'customSignal', // Custom signal or event name
    shouldTerminate: true, // The application will terminate after this handler
  },
)

// Set the error handling strategy to 'continue'
setErrorHandlingStrategy('continue')

// Set a custom exit code
setCustomExitCode(42)
```

## API Reference

This section provides a detailed overview of the functions available in the `shutdown-cleanup` module, allowing for effective management of your application's shutdown process.

### `addSignal(signal: string): boolean`

Adds a new signal or event to the list of signals that will initiate the shutdown process.

```js
import { addSignal } from '@hypercliq/shutdown-cleanup'

addSignal('SIGUSR1')
```

- **Parameters:**
  - `signal` (string): The name of the signal or event to add.
- **Returns:** `true` if the signal was added successfully, `false` if it was already present or has a specific handler.

### `removeSignal(signal: string): boolean`

Removes a signal from the list, preventing it from initiating the shutdown process if received.

```js
import { removeSignal } from '@hypercliq/shutdown-cleanup'

removeSignal('SIGUSR1')
```

- **Parameters:**
  - `signal` (string): The name of the signal or event to remove.
- **Returns:** `true` if the signal was successfully removed, `false` otherwise.

### `registerHandler(handler: Handler, options?: RegisterHandlerOptions): string`

Registers a handler to be executed during the shutdown process or when a specific signal is received.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

const handlerId = registerHandler(
  async (signal) => {
    await performAsyncCleanup()
    console.log(`Handling shutdown for signal: ${signal}`)
  },
  {
    identifier: 'databaseCleanup',
    phase: 3, // Phase number; 1 is the highest priority (default is 1)
  },
)
```

- **Parameters:**
  - `handler` (function): The handler function to execute. It can be synchronous or asynchronous.
  - `options` (object, optional):
    - `identifier` (string): An optional identifier for the handler. A random identifier is generated if not provided.
    - `phase` (number): The phase during which the handler should be executed. Cannot be used together with `signal`.
    - `signal` (string): The signal to listen for. If specified, registers a signal-specific handler. Cannot be used together with `phase`.
    - `shouldTerminate` (boolean): For signal-specific handlers, indicates whether the application should terminate after the handler executes (default is `true`).
- **Returns:** The identifier of the registered handler.

### `removeHandler(identifier: string): boolean`

Removes a previously registered handler by its identifier.

```js
import { removeHandler } from '@hypercliq/shutdown-cleanup'

const success = removeHandler('databaseCleanup')
```

- **Parameters:**
  - `identifier` (string): The identifier of the handler to remove.
- **Returns:** `true` if the handler was successfully removed, `false` otherwise.

### `setErrorHandlingStrategy(strategy: 'continue' | 'stop'): void`

Sets the global error handling strategy for the shutdown process.

```js
import { setErrorHandlingStrategy } from '@hypercliq/shutdown-cleanup'

setErrorHandlingStrategy('stop')
```

- **Parameters:**
  - `strategy` ('continue' | 'stop'): The error handling strategy. `'continue'` continues executing remaining handlers after an error; `'stop'` stops processing further handlers.

### `setCustomExitCode(code: number): void`

Sets a custom exit code to be used when the application exits after the shutdown process is complete.

```js
import { setCustomExitCode } from '@hypercliq/shutdown-cleanup'

setCustomExitCode(42)
```

- **Parameters:**
  - `code` (number): The custom exit code to use.

### `listHandlers(): PhaseEntry[]`

Returns a list of all registered handlers, including both phase and signal-specific handlers.

```js
import { listHandlers } from '@hypercliq/shutdown-cleanup'

const allHandlers = listHandlers()
console.log(allHandlers)
```

- **Returns:** An array of phase entries containing handlers.

### `listSignals(options?: { includeSignalHandlers?: boolean }): string[]`

Provides a list of all signals and events that are currently being listened to by the module.

```js
import { listSignals } from '@hypercliq/shutdown-cleanup'

const signals = listSignals({ includeSignalHandlers: true })
console.log(signals)
```

- **Parameters:**
  - `options` (object, optional):
    - `includeSignalHandlers` (boolean): If `true`, includes signals from signal-specific handlers.
- **Returns:** An array of signal names.

### `setShutdownTimeout(timeout: number): void`

Specifies a timeout for the shutdown process. If the shutdown does not complete within this timeframe, the process is forcibly terminated.

```js
import { setShutdownTimeout } from '@hypercliq/shutdown-cleanup'

setShutdownTimeout(20000) // 20 seconds - default is 30 seconds
```

- **Parameters:**
  - `timeout` (number): The timeout in milliseconds.

## Type Definitions

For TypeScript users, the module includes type definitions to enhance development experience.

```typescript
type Handler = (signal: string | number | Error) => Promise<void> | void

interface RegisterHandlerOptions {
  identifier?: string
  phase?: number
  signal?: string
  shouldTerminate?: boolean
}

interface HandlerEntry {
  identifier: string
  type: 'phase' | 'signal'
  handler: Handler
  signal?: string
  shouldTerminate?: boolean
}

interface PhaseEntry {
  phaseKey: number | 'signal'
  handlers: HandlerEntry[]
}
```

## Additional Tips and Best Practices

- **Async Handlers Are Supported and Handled Safely**: Thanks to internal mechanisms, the module ensures that any errors or promise rejections in your async handlers are properly caught and handled, preventing unhandled promise rejections.

- **Error Handling in Handlers**: While the module handles errors internally, it's still good practice to handle errors within your handlers to manage specific scenarios and maintain clarity in your code.

- **Unique Identifiers**: Use unique identifiers for your handlers to easily manage them, especially when removing handlers or debugging.

- **Phase Numbers**: Assign appropriate phase numbers to ensure handlers execute in the desired order.

- **Signal Management**: Be cautious when adding or removing signals to prevent unintended behavior.

- **Testing Handlers**: Test your handlers thoroughly to ensure they behave as expected during the shutdown process.

- **Avoid Long-Running Operations in Handlers**: If possible, avoid very long-running operations in your handlers to ensure a timely shutdown.

## Conclusion

The `shutdown-cleanup` module provides a robust and flexible solution for managing graceful shutdowns in Node.js applications. By following the best practices outlined in this guide and leveraging the advanced features of the module, you can ensure that your application gracefully handles shutdowns, even in complex scenarios.

---

# Summary

- **Clarified Support for Async Handlers**: Emphasized that the module accepts both synchronous and asynchronous handlers and has implemented measures to handle them properly, mitigating potential issues.

- **Node.js Warning Addressed**: Included a note explaining the Node.js warning about async event handlers and how the module has taken steps to address this concern.

- **Examples Updated**: Provided examples using async handlers to illustrate how users can write their handlers.

- **Best Practices Adjusted**: Encouraged users to handle errors within their handlers while reassuring them that the module provides an additional safety net.

- **Additional Information Included**: Added tips on avoiding long-running operations in handlers and testing handlers thoroughly.
