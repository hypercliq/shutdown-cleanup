# Developer Guide

This guide covers practical use of `@hypercliq/shutdown-cleanup` in Node.js applications. For a short overview and installation instructions, see the [project homepage](https://hypercliq.github.io/shutdown-cleanup/).

## What This Module Does

`shutdown-cleanup` installs process listeners immediately when imported, even if you never register a handler, and runs your cleanup handlers before the process exits. It is designed for work such as closing HTTP servers, flushing logs, stopping queues, disconnecting databases, and releasing other external resources.

The module supports:

- Phased shutdown handlers that run in predictable order.
- Signal-specific handlers for custom behavior on one signal or process event.
- Synchronous and asynchronous handlers.
- Configurable error handling.
- A shutdown timeout to avoid hanging forever.
- TypeScript declarations.

The package is ESM-only and supports Node.js 22.0.0 and newer. This is the consumer runtime minimum; repository development tools require a newer version, as described in [Contributing](https://github.com/hypercliq/shutdown-cleanup/blob/main/CONTRIBUTING.md).

## Quick Start

Register cleanup work with `registerHandler`. Handlers run when one of the default shutdown signals is received.

The short JavaScript snippets in this guide are schematic API illustrations, not standalone programs: they may use application-provided functions or imports from preceding snippets. TypeScript signature blocks describe the API. The [complete HTTP example](#complete-example) is standalone and runnable, with all resources defined and no extra dependencies.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  console.log(`Shutting down after ${signal}`)
  await closeHttpServer()
  await database.disconnect()
})
```

For a standard Node HTTP server, define `closeHttpServer` using the callback-to-Promise wrapper in the complete example. `await server.close()` alone does not wait for closure because `close()` returns the server. The schematic `database.disconnect()` assumes your application's database client returns a Promise that settles when disconnection finishes.

At import time, the module attaches listeners for:

- `SIGTERM`
- `SIGINT`
- `SIGHUP`
- `beforeExit`

The handler argument is the value emitted by Node.js for the signal or event. For POSIX signals, this is usually the signal name. For `beforeExit`, it is the process exit code.

## Phased Shutdown

Handlers are grouped by phase. Lower numbered phases run first. Handlers in the same phase run sequentially in registration order: each returned Promise is awaited before the next handler starts. Phases also run sequentially; the module does not run phased handlers in parallel. If no phase is provided, phase `1` is used.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(
  async () => {
    await closeHttpServer()
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

If you register a signal-specific handler for a default signal such as `SIGTERM`, this module's default listener is replaced for that signal. Removing the handler restores that listener. Other application listeners are left attached; coordinate them to avoid premature exit or competing cleanup.

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

`beforeExit` is already registered by default. You do not need to add it unless you previously removed it. It only fires when Node has no more scheduled work: a listening server, referenced interval, or open connection can prevent it. It is not a way to close resources that themselves keep the event loop alive. It does not run on explicit `process.exit()` or uncaught exceptions, and this module does not install `exit`, `uncaughtException`, or `unhandledRejection` listeners. Adding `exit` cannot make asynchronous cleanup reliable because Node permits only synchronous work there. See [Node.js process events](https://nodejs.org/api/process.html#process-events).

`removeSignal` removes only this module's general shutdown listener; it does not remove a signal-specific handler or other application listeners. Use `removeHandler` for a signal-specific registration.

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

- Safe integer event arguments are used as-is (including the numeric code from `beforeExit`).
- `Error` values use `error.errno` when present.
- POSIX signal names use Node's signal number from `os.constants.signals`, without adding `128` (for example, `SIGINT` normally yields `2`, `SIGTERM` `15`).
- Unknown values fall back to `1`.

The custom exit code must be a number and a safe integer. The module passes it to `process.exit`; it does not constrain it to the conventional 0–255 range. Node/OS exit-status behavior still applies.

Cleanup errors under `continue` are logged but do not change the normal exit code. Timeout and errors under `stop` exit with `1` unless a custom code is set. A custom code overrides all these paths, so `setCustomExitCode(0)` also reports success after timeout or a stopped cleanup. The module explicitly calls `process.exit()` after phased cleanup, including shutdown triggered by `beforeExit`.

## Debugging

```bash
DEBUG=shutdown-cleanup node server.mjs
```

This is POSIX shell syntax; set the environment variable using your shell's equivalent on other platforms. Logging uses `console.debug` with a `shutdown-cleanup` prefix and includes registration, signal handling, shutdown progress, and exit code. `DEBUG` is captured when the module is imported, so set it before starting Node. Logging is enabled when the value contains `shutdown-cleanup` or is exactly `*`. Matching is a simple regular expression, not the `debug` package's namespace or exclusion syntax: even `-shutdown-cleanup` matches. No debugging dependency is needed. Errors and timeout warnings are logged regardless of `DEBUG`.

## Inspecting and Removing Handlers

Use explicit identifiers when you expect to inspect or remove handlers later.

```js
import {
  listHandlers,
  registerHandler,
  removeHandler,
} from '@hypercliq/shutdown-cleanup'

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

The exit code must be a number and a safe integer; it overrides normal completion, timeout, and `stop` errors.

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

This declaration describes the expected argument types; the runtime forwards the first process-event argument without validating it. A custom event with no argument can supply `undefined`, and other payload types are possible in JavaScript. Supply an argument matching `Handler` when using TypeScript.

## Complete Example

Install the package, save the following as `server.mjs`, and run `node server.mjs` on Node.js 22.0.0 or newer. It uses only Node built-ins and `@hypercliq/shutdown-cleanup`; there is no database or other undefined resource.

```js
import { once } from 'node:events'
import { createServer } from 'node:http'
import {
  registerHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '@hypercliq/shutdown-cleanup'

const server = createServer((_request, response) => {
  response.end('Hello\n')
})

const closeHttpServer = () =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })

setShutdownTimeout(20_000)
setErrorHandlingStrategy('stop')
setCustomExitCode(0)

registerHandler(closeHttpServer, { identifier: 'closeServer', phase: 1 })
registerHandler(() => console.log('HTTP server closed'), { phase: 2 })

server.listen(0, '127.0.0.1')
await once(server, 'listening')
console.log(`Listening at http://127.0.0.1:${server.address().port}`)
console.log(`Send SIGTERM to PID ${process.pid}, or press Ctrl+C`)
```

Open the printed URL, then press Ctrl+C, or run `kill -TERM <printed-pid>` in a second terminal on POSIX systems. Phase 1 stops accepting new connections and waits for the HTTP close callback; phase 2 runs only after closure. The wrapper preserves `server` as the receiver and rejects callback errors. This example uses `stop` so a closure error skips the success message. Its custom code of `0` overrides even errors and timeout; remove that setting if you want the default policy.

Node's [`server.close(callback)`](https://nodejs.org/api/http.html#serverclosecallback) waits for active HTTP connections to finish and closes idle connections on supported Node versions. Long-running requests can exhaust the shutdown budget. Upgraded connections such as WebSockets need their own cleanup; this example creates none. The library timeout forces process exit rather than guaranteeing that every connection finishes.

## Migration From Older Versions

### Version 8 runtime and validation changes

Version 8 raises the consumer runtime requirement from **Node.js >=18** in version 7.0.1 to **Node.js >=22** in version 8.0.0. Upgrade deployment images, local runtimes, and process-manager/CI runtime settings before upgrading the package. Node.js 18, 19, 20, and 21 are no longer supported. Version 8 uses iterator helpers and `Array.prototype.toSorted`; transpiling import syntax alone does not supply these runtime features. The current `>=22.0.0` spelling preserves the version-8 minimum.

This is verified by the tagged [v7.0.1 package manifest](https://github.com/hypercliq/shutdown-cleanup/blob/v7.0.1/package.json), [v8.0.0 manifest](https://github.com/hypercliq/shutdown-cleanup/blob/v8.0.0/package.json), and [runtime changes](https://github.com/hypercliq/shutdown-cleanup/compare/v7.0.1...v8.0.0). The [Node 24 tooling update](https://github.com/hypercliq/shutdown-cleanup/commit/62b85c2c97c83188e7338ca4691f3df43bfb0a65) did not raise `engines.node` to 24. Repository tooling has its own minimum in Contributing.

Version 8 also stopped coercing phase values with `parseInt`: pass positive safe integers, not strings or fractions. Shutdown timeout values must be positive finite numbers, and custom exit codes must be numeric safe integers. Under `continue`, a failed terminating signal-specific handler now proceeds to phased cleanup; version 7 could skip that cleanup on rejection.

### Subsequent implementation changes

The following describes the finalized implementation in this checkout, including changes after the v8.0.3 tag; it should not be read as a claim that all of these behaviors shipped in v8.0.0.

Registration now validates inputs before changing the registry or replacing listeners. This fixes empty groups left behind by invalid phases and uncatchable signals. It also tightens JavaScript validation to match the declared option types: primitives, arrays, and functions used as options, non-string identifiers or signals, `phase: null`, non-boolean `shouldTerminate` values, and `shouldTerminate` without a signal are rejected. Earlier versions could accept these values through destructuring, truthiness, or ignored options; this is a compatibility change for callers relying on those behaviors. Use an options object, string identifiers and event names, numeric phases, and boolean termination flags; omit optional values or use `undefined` for defaults. Values are not coerced to strings or booleans.

Empty string identifiers, arbitrary string process event names, inherited option properties, and ignored extra keys remain supported in JavaScript. `signal: ''` now registers the empty-name process event, consistent with other string event names, whereas it previously fell through to a phase handler. Callers using an empty signal to request phased cleanup should omit `signal` instead. No signal allowlist or new public API is introduced.

Phased cleanup now uses a fixed snapshot taken when shutdown starts. Previously, newly registered handlers could run if added to a current or future phase, and handlers registered by a terminating signal-specific handler could join the subsequent phases. Those registrations are now excluded from the active cleanup; perform and await any required late cleanup directly instead. Removing pending handlers remains supported, and removing the last handler in a future phase now safely skips it instead of throwing. Phase ordering, registration ordering, and exit-code conventions are unchanged.

Terminating signal-specific handlers now run inside the shutdown guard and timeout. Previously, their runtime was outside the timeout, repeated events could invoke them more than once, and a competing default signal or `beforeExit` could start phases before they finished. Applications relying on that behavior should account for the signal-specific handler's runtime in `setShutdownTimeout` and use `shouldTerminate: false` for repeatable signal actions. This changes when cleanup can be interrupted or skipped; it adds no public API and leaves exit-code conventions unchanged.

### Version 7 registration API

These old/new snippets are schematic migration illustrations using application-provided `cleanup`.

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

Replace the old `registerSignalHandler` import with `registerHandler`. For existing phased `registerHandler` calls, replace positional identifier and phase arguments with an options object.

## Operational Notes

- Register cleanup handlers during application startup.
- Keep handlers idempotent where possible. Further terminating signals and events are ignored once shutdown starts; `shouldTerminate: false` handlers remain repeatable.
- Prefer asynchronous I/O cleanup over long synchronous work.
- Avoid calling `process.exit()` inside handlers unless you intentionally want to bypass later cleanup.
- Use explicit handler identifiers in production services so logs are meaningful.
- Test shutdown behavior with the same signals your process manager sends, usually `SIGTERM`.
