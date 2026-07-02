# Developer Guide

This guide covers practical use of `@hypercliq/shutdown-cleanup` in Node.js applications. For a short overview and installation instructions, see the [project homepage](https://hypercliq.github.io/shutdown-cleanup/).

## What This Module Does

`shutdown-cleanup` installs process listeners and runs your cleanup handlers before the process exits. It is designed for work such as closing HTTP servers, flushing logs, stopping queues, disconnecting databases, and releasing other external resources.

The module supports:

- Phased shutdown handlers that run in predictable order.
- Signal-specific handlers for custom behavior on one signal or process event.
- Synchronous and asynchronous handlers.
- Configurable error handling.
- A shutdown timeout to avoid hanging forever.
- TypeScript declarations.

The package is ESM-only and supports Node.js 18 and newer.

## Quick Start

Register cleanup work with `registerHandler`. Handlers run when one of the default shutdown signals is received.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  console.log(`Shutting down after ${signal}`)
  await server.close()
  await database.disconnect()
})
```

By default, the module listens for:

- `SIGTERM`
- `SIGINT`
- `SIGHUP`
- `beforeExit`

The handler argument is the value emitted by Node.js for the signal or event. For POSIX signals, this is usually the signal name. For `beforeExit`, it is the process exit code.

## Phased Shutdown

Handlers are grouped by phase. Lower numbered phases run first. Handlers in the same phase run in registration order. If no phase is provided, phase `1` is used.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(
  async () => {
    await server.close()
  },
  {
    identifier: 'closeServer',
    phase: 1,
  },
)

registerHandler(
  async () => {
    await database.disconnect()
  },
  {
    identifier: 'disconnectDatabase',
    phase: 2,
  },
)
```

Use phases when one cleanup step depends on another. For example, stop accepting requests before disconnecting the database.

## Signal-Specific Handlers

Signal-specific handlers let you attach behavior to a single signal or process event.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(
  async () => {
    console.log('Received SIGUSR1')
  },
  {
    identifier: 'debugSignal',
    signal: 'SIGUSR1',
    shouldTerminate: false,
  },
)
```

When `shouldTerminate` is `false`, the handler runs and the process stays alive. When `shouldTerminate` is omitted or `true`, the signal-specific handler runs first, then the normal phased shutdown runs.

If you register a signal-specific handler for a default signal such as `SIGTERM`, the default listener is replaced for that signal. Removing the handler restores the default listener.

## Custom Events

You can also listen for custom process events by using the event name as `signal`.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

const eventName = 'app:shutdown'

registerHandler(
  async (exitCode) => {
    console.log(`Received ${eventName}`)
    console.log(`Requested exit code: ${exitCode}`)
  },
  {
    identifier: 'applicationShutdown',
    signal: eventName,
  },
)

process.emit(eventName, 0)
```

Node passes emitted event arguments to listeners. The first emitted argument becomes the handler argument and, when `shouldTerminate` is `true`, is also used to determine the exit code. Passing a number is the clearest way to control the exit code for custom events.

If you need the event name inside the handler, close over it as shown above.

## Managing Signals

Use `addSignal` to make another signal or event trigger phased shutdown.

```js
import { addSignal, removeSignal } from '@hypercliq/shutdown-cleanup'

addSignal('SIGUSR2')
removeSignal('SIGHUP')
```

`SIGKILL` and `SIGSTOP` cannot be handled and will throw if you try to add or register them.

`beforeExit` is already registered by default. You do not need to add it unless you previously removed it.

## Error Handling

The default strategy is `continue`. If a phased shutdown handler throws or rejects, the error is logged and the remaining handlers continue.

```js
import { setErrorHandlingStrategy } from '@hypercliq/shutdown-cleanup'

setErrorHandlingStrategy('continue')
```

Use `stop` when a failed cleanup step should prevent later handlers from running.

```js
setErrorHandlingStrategy('stop')
```

With `stop`, the process exits immediately with the custom exit code if one was set, otherwise `1`.

Signal-specific handler errors follow the same strategy. Under `continue`, a terminating signal-specific handler still proceeds into the normal phased shutdown after logging the error.

## Shutdown Timeout

The shutdown timeout protects against asynchronous handlers that never settle.

```js
import { setShutdownTimeout } from '@hypercliq/shutdown-cleanup'

setShutdownTimeout(20_000)
```

The default timeout is 30 seconds. The value must be a positive finite number of milliseconds.

The timeout cannot interrupt CPU-bound synchronous work that blocks the event loop. Keep synchronous handlers short.

## Custom Exit Codes

Use `setCustomExitCode` to override the exit code used after shutdown.

```js
import { setCustomExitCode } from '@hypercliq/shutdown-cleanup'

setCustomExitCode(0)
```

Without a custom exit code:

- Numeric signal values are used as-is.
- `Error` values use `error.errno` when present.
- POSIX signal names use Node's signal number from `os.constants.signals`.
- Unknown values fall back to `1`.

The custom exit code must be an integer.

## Inspecting and Removing Handlers

Use explicit identifiers when you expect to inspect or remove handlers later.

```js
import { listHandlers, removeHandler } from '@hypercliq/shutdown-cleanup'

const identifier = registerHandler(cleanup, {
  identifier: 'cleanup',
})

console.log(listHandlers())
removeHandler(identifier)
```

Generated identifiers are returned from `registerHandler`, but named identifiers make logs and debugging easier.

## API Reference

### `registerHandler(handler, options?)`

Registers a phased shutdown handler or a signal-specific handler.

```ts
registerHandler(handler: Handler, options?: RegisterHandlerOptions): string
```

Options:

- `identifier?: string`: Unique handler identifier. A random identifier is generated when omitted.
- `phase?: number`: Positive integer phase for phased shutdown handlers. Defaults to `1`.
- `signal?: string`: Signal or event name for a signal-specific handler.
- `shouldTerminate?: boolean`: For signal-specific handlers, controls whether phased shutdown runs after the handler. Defaults to `true`.

Rules:

- `handler` must be a function.
- `phase` and `signal` cannot be used together.
- `phase` must be a positive integer.
- `identifier` must be unique across all handlers.
- Only one signal-specific handler can be registered for a given signal.
- `SIGKILL` and `SIGSTOP` cannot be handled.

Returns the handler identifier.

### `removeHandler(identifier)`

Removes a registered handler by identifier.

```ts
removeHandler(identifier: string): boolean
```

Returns `true` when a handler was removed, otherwise `false`.

### `listHandlers()`

Lists all registered phased and signal-specific handlers.

```ts
listHandlers(): PhaseEntry[]
```

The signal-specific group is reported with `phaseKey: 'signal'`.

### `addSignal(signal)`

Adds a signal or process event that should trigger phased shutdown.

```ts
addSignal(signal: string): boolean
```

Returns `true` when the signal was added. Returns `false` if it was already registered or already has a signal-specific handler.

### `removeSignal(signal)`

Removes a signal from the set of signals that trigger phased shutdown.

```ts
removeSignal(signal: string): boolean
```

Returns `true` when the signal was removed, otherwise `false`.

### `listSignals(options?)`

Lists signals that currently trigger shutdown.

```ts
listSignals(options?: { includeSignalHandlers?: boolean }): string[]
```

Set `includeSignalHandlers: true` to include signals that are handled by signal-specific handlers.

### `setErrorHandlingStrategy(strategy)`

Configures handler error behavior.

```ts
setErrorHandlingStrategy(strategy: 'continue' | 'stop'): void
```

The default strategy is `continue`.

### `setShutdownTimeout(timeout)`

Sets the maximum time allowed for phased shutdown.

```ts
setShutdownTimeout(timeout: number): void
```

The timeout must be a positive finite number of milliseconds.

### `setCustomExitCode(code)`

Sets the process exit code used after shutdown.

```ts
setCustomExitCode(code: number): void
```

The exit code must be an integer.

## TypeScript

The package includes TypeScript declarations and exports these types:

```ts
import type {
  Handler,
  HandlerEntry,
  PhaseEntry,
  RegisterHandlerOptions,
} from '@hypercliq/shutdown-cleanup'
```

`Handler` is typed as:

```ts
type Handler = (signal: string | number | Error) => Promise<void> | void
```

## Complete Example

```js
import {
  registerHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '@hypercliq/shutdown-cleanup'

setShutdownTimeout(20_000)
setErrorHandlingStrategy('continue')
setCustomExitCode(0)

registerHandler(
  async () => {
    await server.close()
  },
  {
    identifier: 'closeServer',
    phase: 1,
  },
)

registerHandler(
  async () => {
    await database.disconnect()
  },
  {
    identifier: 'disconnectDatabase',
    phase: 2,
  },
)
```

## Migration From Older Versions

Version 7 unified the old phase and signal registration APIs behind `registerHandler`.

Old phase handler style:

```js
registerHandler(
  async () => {
    await cleanup()
  },
  'cleanupHandler',
  1,
)
```

New phase handler style:

```js
registerHandler(
  async () => {
    await cleanup()
  },
  {
    identifier: 'cleanupHandler',
    phase: 1,
  },
)
```

Old signal handler style:

```js
registerSignalHandler(
  'SIGUSR1',
  async () => {
    console.log('Handling SIGUSR1')
  },
  false,
)
```

New signal handler style:

```js
registerHandler(
  async () => {
    console.log('Handling SIGUSR1')
  },
  {
    signal: 'SIGUSR1',
    shouldTerminate: false,
  },
)
```

If you were importing `registerSignalHandler` or `registerPhaseHandler`, replace those imports with `registerHandler` and pass an options object.

## Operational Notes

- Register cleanup handlers during application startup.
- Keep handlers idempotent where possible. A second signal received during shutdown is ignored.
- Prefer asynchronous I/O cleanup over long synchronous work.
- Avoid calling `process.exit()` inside handlers unless you intentionally want to bypass later cleanup.
- Use explicit handler identifiers in production services so logs are meaningful.
- Test shutdown behavior with the same signals your process manager sends, usually `SIGTERM`.
