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

The package is ESM-only and supports Node.js 22.0.0 and newer. This is the consumer runtime minimum; repository development tools require a newer version, as described in [Contributing](CONTRIBUTING.md).

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

### Registering and Removing Handlers During Shutdown

When shutdown starts, the module snapshots all phased handler registrations before invoking any cleanup, including a terminating signal-specific handler. The snapshot runs in ascending phase order and registration order within each phase.

- Removing a handler before its invocation skips it, including removals made while an earlier asynchronous handler is suspended. If every handler in a future phase is removed, that phase is safely skipped and later phases still run.
- Removing a handler that is already running, including self-removal, does not cancel its invocation. Shutdown still awaits its completion and applies the configured error strategy.
- Registrations made after shutdown starts are accepted and visible through `listHandlers()`, but never join the active phased cleanup. This applies to the current phase, future phases, new phases, and registrations made by the terminating signal-specific handler. Newly registered work therefore cannot keep extending the cleanup queue.
- Removing and re-registering an identifier creates a new registration, even with the same function and phase. The removed registration is skipped and its replacement is excluded from the active cleanup.

Register all required cleanup during application startup. If a cleanup handler needs to perform additional work during shutdown, perform and await that work inside the handler. The existing rules for repeatable signal-specific handlers with `shouldTerminate: false` still apply.

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

When `shouldTerminate` is `false`, the handler runs without starting shutdown. It remains repeatable, including while shutdown is in progress; repeated events can run overlapping invocations. Errors still follow the configured error strategy, so `stop` exits on failure.

When `shouldTerminate` is omitted or `true`, the signal-specific handler and the normal phased cleanup form one shutdown operation. The shutdown guard and deadline start before the signal-specific handler is invoked. That handler runs first, then the phases run in order. Further terminating signals or events (including `beforeExit`) are ignored throughout this operation, even if they have their own signal-specific handlers. The first trigger's argument is passed to the handler and phases and determines the normal exit code.

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

One deadline covers the entire shutdown operation: the terminating signal-specific handler, if any, followed by all phased handlers. Time spent in the signal-specific handler consumes the same budget as the phases; starting phased cleanup does not reset the deadline, nor does an error under `continue`. For example, with a 20-second timeout, a signal-specific handler that takes 12 seconds leaves about 8 seconds for all phases together. A signal-specific handler that never settles is subject to the same timeout. The timer also keeps the process alive while asynchronous cleanup is pending, including cleanup started by `beforeExit`.

Handlers registered with `shouldTerminate: false` do not start a shutdown timer. If they run while another trigger has already started shutdown, that operation's deadline still applies to process termination. On timeout, the process exits with the custom exit code if set, otherwise `1`.

The deadline remains subject to Node.js and OS limitations:

- The timeout uses Node's `setTimeout`; it is not a guaranteed wall-clock termination time. Blocking synchronous work or starving the event loop delays the timer and signal callbacks. Keep synchronous handlers short. Node also truncates fractional delays and converts delays below `1` or above `2_147_483_647` milliseconds to `1` millisecond. See [Node.js timers](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).
- `SIGKILL` cannot be caught and prevents cleanup; `SIGSTOP` cannot be caught and suspends execution, including the timer. Signal support and delivery vary by OS, especially on Windows. A supervisor or OS can terminate the process before cleanup finishes. See [Node.js signal events](https://nodejs.org/api/process.html#signal-events).
- `beforeExit` is emitted when the event loop drains, not on an explicit `process.exit()` or an uncaught exception. The `exit` event cannot wait for asynchronous cleanup. See [Node.js process events](https://nodejs.org/api/process.html#process-events).
- Forced exit does not wait for pending asynchronous I/O, including log writes, and cannot guarantee that cleanup finishes. See [Node.js `process.exit()`](https://nodejs.org/api/process.html#processexitcode).

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

- `identifier?: string`: Unique string handler identifier, including an empty string. An identifier is generated when omitted or `undefined`.
- `phase?: number`: Positive safe integer phase for phased shutdown handlers. Defaults to `1` when omitted or `undefined`.
- `signal?: string`: Signal or process event name for a signal-specific handler. Any string, including an empty event name, selects a signal-specific handler; omitted or `undefined` selects a phased handler.
- `shouldTerminate?: boolean`: For signal-specific handlers, controls whether phased shutdown runs after the handler. Defaults to `true`.

Rules:

- `handler` must be a function.
- `options` must be a non-null object, excluding arrays; omitted or `undefined` uses the defaults. JavaScript options may have inherited properties or extra keys; extra keys are ignored.
- `phase` and `signal` cannot be used together.
- `phase` must be a positive safe integer.
- `identifier` must be a string and unique across all handlers.
- `signal` must be a string; custom process event names are supported without a POSIX signal allowlist.
- `shouldTerminate` must be a boolean when provided and can only be used with `signal`. Omitted or `undefined` uses the default.
- Only one signal-specific handler can be registered for a given signal.
- `SIGKILL` and `SIGSTOP` cannot be handled.

Returns the handler identifier as a string. Invalid input types throw `TypeError`; invalid phases, incompatible options, duplicate identifiers or signals, and uncatchable signals throw `Error`. Rejected registrations leave `listHandlers()`, both forms of `listSignals()`, and process listeners unchanged.

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

Sets the maximum time allowed for a terminating signal-specific handler and all subsequent phased cleanup together, or for phased cleanup alone when triggered by a default listener.

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

Registration now validates inputs before changing the registry or replacing listeners. This fixes empty groups left behind by invalid phases and uncatchable signals. It also tightens JavaScript validation to match the declared option types: primitives, arrays, and functions used as options, non-string identifiers or signals, `phase: null`, non-boolean `shouldTerminate` values, and `shouldTerminate` without a signal are rejected. Earlier versions could accept these values through destructuring, truthiness, or ignored options; this is a compatibility change for callers relying on those behaviors. Use an options object, string identifiers and event names, numeric phases, and boolean termination flags; omit optional values or use `undefined` for defaults. Values are not coerced to strings or booleans.

Empty string identifiers, arbitrary string process event names, inherited option properties, and ignored extra keys remain supported in JavaScript. `signal: ''` now registers the empty-name process event, consistent with other string event names, whereas it previously fell through to a phase handler. Callers using an empty signal to request phased cleanup should omit `signal` instead. No signal allowlist or new public API is introduced.

Phased cleanup now uses a fixed snapshot taken when shutdown starts. Previously, newly registered handlers could run if added to a current or future phase, and handlers registered by a terminating signal-specific handler could join the subsequent phases. Those registrations are now excluded from the active cleanup; perform and await any required late cleanup directly instead. Removing pending handlers remains supported, and removing the last handler in a future phase now safely skips it instead of throwing. Phase ordering, registration ordering, and exit-code conventions are unchanged.

Terminating signal-specific handlers now run inside the shutdown guard and timeout. Previously, their runtime was outside the timeout, repeated events could invoke them more than once, and a competing default signal or `beforeExit` could start phases before they finished. Applications relying on that behavior should account for the signal-specific handler's runtime in `setShutdownTimeout` and use `shouldTerminate: false` for repeatable signal actions. This changes when cleanup can be interrupted or skipped; it adds no public API and leaves exit-code conventions unchanged.

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
- Keep handlers idempotent where possible. Further terminating signals and events are ignored once shutdown starts; `shouldTerminate: false` handlers remain repeatable.
- Prefer asynchronous I/O cleanup over long synchronous work.
- Avoid calling `process.exit()` inside handlers unless you intentionally want to bypass later cleanup.
- Use explicit handler identifiers in production services so logs are meaningful.
- Test shutdown behavior with the same signals your process manager sends, usually `SIGTERM`.
