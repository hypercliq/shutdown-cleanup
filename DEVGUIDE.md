# Developer Guide

This developer guide provides in-depth documentation on how to use the `shutdown-cleanup` module effectively in your Node.js applications, covering best practices, detailed examples, advanced usage scenarios, and guidance on migrating from earlier versions.

## Introduction

The `shutdown-cleanup` module offers a structured approach to gracefully handle shutdown processes in Node.js applications. It supports:

- **Phased Shutdowns**: Organize cleanup tasks into phases for orderly execution.
- **Signal-Specific Handlers**: Define custom logic for specific signals without mandatory shutdown.
- **Custom Error Handling**: Choose how the module handles errors in your handlers.
- **Custom Exit Codes**: Specify exit codes to indicate shutdown statuses.
- **Support for Both Synchronous and Asynchronous Handlers**: Flexibility in how you write your handlers.
- **TypeScript Support**: Includes type definitions for better development experience.

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
- **Error Handling**: It's still good practice to handle errors within your handlers for clarity and to manage specific error scenarios.
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

## Migration Guide

If you are upgrading from a previous version of the `shutdown-cleanup` module, this section will help you migrate your code to the latest version.

### Key Changes in the Latest Version

1. **Unified `registerHandler` Function**: The functions `registerSignalHandler` and `registerPhaseHandler` have been unified into a single `registerHandler` function with options.

2. **Support for Both Synchronous and Asynchronous Handlers**: The module now accepts both synchronous and asynchronous handler functions.

3. **Improved Error Handling**: The module has enhanced error handling internally to catch both synchronous exceptions and promise rejections in handlers.

4. **TypeScript Definitions Updated**: Type definitions have been updated to reflect the new API.

### Migration Steps

#### 1. Update Handler Registration

**Before (Old Version):**

```javascript
import {
  registerHandler,
  registerSignalHandler,
} from '@hypercliq/shutdown-cleanup'

// Registering a phase handler
registerHandler(
  async (signal) => {
    await performCleanup()
  },
  'cleanupHandler',
  1,
)

// Registering a signal-specific handler
registerSignalHandler(
  'SIGUSR1',
  async (signal) => {
    console.log('Handling SIGUSR1')
  },
  false,
)
```

**After (New Version):**

```javascript
import { registerHandler } from '@hypercliq/shutdown-cleanup'

// Registering a phase handler
registerHandler(
  async (signal) => {
    await performCleanup()
  },
  {
    identifier: 'cleanupHandler',
    phase: 1,
  },
)

// Registering a signal-specific handler
registerHandler(
  async (signal) => {
    console.log('Handling SIGUSR1')
  },
  {
    signal: 'SIGUSR1',
    shouldTerminate: false,
  },
)
```

- **What's Changed**: Instead of separate functions, you now use `registerHandler` with an options object to specify `identifier`, `phase`, `signal`, and `shouldTerminate`.

#### 2. Remove Deprecated Functions

- **Removed Functions**: If you were using `registerSignalHandler` or `registerPhaseHandler`, replace them with `registerHandler` as shown above.
- **Example**:

  ```javascript
  // Remove or replace calls to registerSignalHandler and registerPhaseHandler
  ```

#### 3. Adjust Error Handling Strategy

- If you were relying on default error handling behavior, review the new `setErrorHandlingStrategy` function to ensure it aligns with your application's needs.

#### 4. Verify Handlers

- **Synchronous Handlers**: If you had synchronous handlers, they will continue to work as before.
- **Asynchronous Handlers**: You can now safely use `async` functions as handlers without additional wrapping.

#### 5. Update TypeScript Imports (If Applicable)

- **Type Definitions**: Update your imports to ensure you are using the latest types.

  ```typescript
  import { Handler, RegisterHandlerOptions } from '@hypercliq/shutdown-cleanup'
  ```

#### 6. Test Thoroughly

- After making changes, test your application thoroughly to ensure that shutdown sequences execute as expected.

### Example Migration

**Before Migration:**

```javascript
import {
  registerHandler,
  registerSignalHandler,
} from '@hypercliq/shutdown-cleanup'

// Phase handler
registerHandler(
  async (signal) => {
    await cleanUpResources()
  },
  'resourceCleanup',
  1,
)

// Signal-specific handler
registerSignalHandler(
  'SIGUSR2',
  async (signal) => {
    console.log('Received SIGUSR2')
  },
  true,
)
```

**After Migration:**

```javascript
import { registerHandler } from '@hypercliq/shutdown-cleanup'

// Phase handler
registerHandler(
  async (signal) => {
    await cleanUpResources()
  },
  {
    identifier: 'resourceCleanup',
    phase: 1,
  },
)

// Signal-specific handler
registerHandler(
  async (signal) => {
    console.log('Received SIGUSR2')
  },
  {
    signal: 'SIGUSR2',
    shouldTerminate: true,
  },
)
```

## API Reference

This section provides a detailed overview of the functions available in the `shutdown-cleanup` module, allowing for effective management of your application's shutdown process.

_(The API Reference remains the same as detailed in the earlier sections.)_

## Type Definitions

For TypeScript users, the module includes type definitions to enhance development experience.

_(Type Definitions remain the same as detailed in the earlier sections.)_

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
