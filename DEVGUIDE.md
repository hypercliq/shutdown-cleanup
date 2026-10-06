# Consumer guide

For installation and a runnable HTTP example, see the [homepage](https://hypercliq.github.io/shutdown-cleanup/). The package is ESM-only and requires Node.js >=22.0.0. Examples below illustrate APIs; functions such as `cleanup` represent application code.

## Shutdown behavior

Importing the module immediately attaches listeners for `SIGTERM`, `SIGHUP`, `SIGINT`, and `beforeExit`, even with no handlers registered. Each handler receives the first process-event argument: usually a signal name, or the exit code for `beforeExit`. Custom payloads are forwarded without validation.

Phases run in ascending numeric order; handlers within each phase run in registration order. Every returned Promise is awaited before the next handler starts. The default phase is `1`.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(closeHttpServer, { identifier: 'http', phase: 1 })
registerHandler(disconnectDatabase, { identifier: 'database', phase: 2 })
```

Register required cleanup during startup. Shutdown takes a fixed snapshot of phased registrations before any handler runs. Removing a pending handler skips it; removing a running handler does not cancel it. New registrations, including replacements of removed identifiers, are excluded from active cleanup. Perform and await any late cleanup directly inside a running handler.

A terminating signal-specific handler runs first, followed by the phases, under one guard and deadline. Further terminating events, including `beforeExit`, are ignored. The first trigger's argument is passed to all handlers and determines the normal exit code. Other application process listeners remain attached; coordinate them to avoid competing cleanup or premature exit.

## Platforms and limitations

Supported release targets are Linux, Windows, and macOS on ARM64 and Intel x64. CI requires the packed package to pass native and portable tests on each target with Node 22.0.0, current 22.x, 24.x, and 26.x. Registering a signal or emitting its name as a process event does not prove native OS delivery; `listSignals()` reports registrations, not platform capabilities.

| Trigger                    | Linux / macOS behavior                               | Windows behavior                                                                             |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Custom process event       | Application emits it                                 | Application emits it                                                                         |
| Natural `beforeExit`       | Event loop must drain                                | Event loop must drain                                                                        |
| Ctrl+C / `SIGINT`          | Graceful trigger                                     | Console Ctrl+C can trigger cleanup                                                           |
| `SIGTERM`                  | Graceful trigger                                     | No graceful OS delivery; `process.kill(pid, 'SIGTERM')` forcibly terminates                  |
| `SIGHUP` / console closure | Graceful trigger                                     | Console closure can deliver `SIGHUP`, but Windows forcibly terminates after about 10 seconds |
| `SIGUSR2`                  | Opt in with `addSignal` or a signal-specific handler | No OS delivery                                                                               |
| Ctrl+Break / `SIGBREAK`    | No OS delivery                                       | Opt in with `addSignal` or a signal-specific handler                                         |
| Forced termination         | No cleanup guarantee, including `SIGKILL`            | No cleanup guarantee, including `TerminateProcess`, `taskkill /F`, and kill emulation        |

Runner coverage does not certify every OS version, terminal, or service host. Terminal raw mode can prevent Ctrl+C signal delivery. Windows services do not automatically receive console events; this package installs no service-control handler. Supervisors, terminal hosts, containers, and OS deadlines can prevent or interrupt cleanup. Test the actual shutdown mechanism your application uses. The package's timeout cannot extend an OS deadline.

`beforeExit` fires only when Node has no scheduled work. A listening server, referenced interval, or open connection can prevent it; use a signal or custom event to close resources keeping the loop alive. Explicit `process.exit()` and uncaught exceptions bypass it. The package installs no `exit`, `uncaughtException`, or `unhandledRejection` listeners. An `exit` listener cannot await asynchronous cleanup.

`SIGKILL` and `SIGSTOP` are uncatchable; registration throws. Suspension also stops the deadline timer. Node reserves `SIGUSR1` for debugger startup. Crash/fault signals cannot guarantee graceful cleanup. See [Node signal and process events](https://nodejs.org/api/process.html#signal-events).

For HTTP servers, wrap [`server.close(callback)`](https://nodejs.org/api/http.html#serverclosecallback) in a Promise as in the README: it returns the server, not a Promise. Active requests can exhaust the deadline; upgraded connections such as WebSockets need separate cleanup. Forced exit does not wait for pending I/O, including log writes.

## Signal-specific handlers and custom events

```js
import { addSignal, registerHandler } from '@hypercliq/shutdown-cleanup'

addSignal('SIGUSR2') // POSIX opt-in trigger for phased shutdown

registerHandler(reportStatus, {
  identifier: 'status',
  signal: 'app:status',
  shouldTerminate: false,
})
process.emit('app:status', 0)

registerHandler(prepareShutdown, { signal: 'app:shutdown' })
process.emit('app:shutdown', 0)
```

`shouldTerminate` defaults to `true`. With `false`, the handler remains repeatable, may overlap earlier invocations, and runs even during shutdown without starting its own timer. Errors still follow the configured strategy, so `stop` exits on failure.

A signal-specific registration replaces this module's general listener for that event; removing the handler restores it if the event was in the general trigger set. `removeSignal` removes only the general listener, not a signal-specific handler or other application listeners. Use `removeHandler` for signal-specific registrations. Failed listener attachment leaves no recorded active signal.

For custom shutdown events, a numeric first argument is the clearest way to select the exit code. Close over the event name if you need it inside the handler.

## Errors, deadline, and exit codes

```js
import {
  setErrorHandlingStrategy,
  setShutdownTimeout,
  setCustomExitCode,
} from '@hypercliq/shutdown-cleanup'

setErrorHandlingStrategy('stop')
setShutdownTimeout(20_000)
// Optional: overrides every exit path, including failures.
setCustomExitCode(0)
```

The default error strategy is `continue`: log a thrown/rejected error and run the remaining cleanup. A failed terminating signal-specific handler also proceeds to the phases. `stop` immediately exits and skips remaining handlers.

The default deadline is **30 seconds**, shared by the terminating signal-specific handler and all phases. It starts before any cleanup, is never reset, and keeps Node alive while async cleanup is pending. Non-terminating handlers start no timer. Timeout forces exit rather than guaranteeing completion.

The timeout uses Node's `setTimeout`: synchronous blocking or event-loop starvation delays it. Keep synchronous work short. Node truncates fractional delays and converts values below `1` or above `2_147_483_647` milliseconds to `1` millisecond; see [timer semantics](https://nodejs.org/api/timers.html#settimeoutcallback-delay-args).

Without a custom code, normal completion uses:

- Safe integer event arguments as-is, including `beforeExit` codes.
- An `Error`'s `errno` when present.
- Node's signal number for recognized signal names, **without adding 128** (for example, `SIGINT` normally gives `2`, `SIGTERM` `15`).
- `1` for unknown values.

Errors under `continue` do not change that normal code. Timeout and `stop` errors use `1`. A custom exit code overrides **all** these paths: setting `0` also reports success after failure or timeout. Codes must be numeric safe integers; the package imposes no 0–255 restriction, though Node/OS status handling still applies. Cleanup ends with an explicit `process.exit()`, including after `beforeExit`.

## API reference

```ts
registerHandler(handler: Handler, options?: RegisterHandlerOptions): string
```

Returns a unique identifier. Options:

| Option                      | Contract                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `identifier?: string`       | Unique across all handlers; generated when omitted. Empty strings are valid.                                        |
| `phase?: number`            | Positive safe integer; defaults to `1`. Cannot be combined with `signal`.                                           |
| `signal?: string`           | Any string process event name, including `''`; only one signal-specific handler per event. Omit for phased cleanup. |
| `shouldTerminate?: boolean` | Only valid with `signal`; defaults to `true`.                                                                       |

`handler` must be a function. `options` must be a non-null object excluding arrays; omission or `undefined` uses defaults. Inherited properties and extra keys are accepted in JavaScript; extra keys are ignored. Optional properties set to `undefined` use defaults. Values are not coerced.

Invalid types throw `TypeError`; invalid phases, incompatible options, duplicate identifiers/signals, and uncatchable signals throw `Error`. Rejected registrations leave registries and listeners unchanged.

| Function                                                               | Result / constraint                                                                               |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `removeHandler(identifier: string): boolean`                           | `true` if removed, otherwise `false`.                                                             |
| `listHandlers(): PhaseEntry[]`                                         | All registrations; signal-specific group has `phaseKey: 'signal'`.                                |
| `addSignal(signal: string): boolean`                                   | `true` if added; `false` if already registered or signal-specific. Listener attachment can throw. |
| `removeSignal(signal: string): boolean`                                | `true` if a general trigger was removed, otherwise `false`.                                       |
| `listSignals(options?: { includeSignalHandlers?: boolean }): string[]` | General triggers; set `includeSignalHandlers: true` to include signal-specific events.            |
| `setErrorHandlingStrategy(strategy): void`                             | `'continue'` (default) or `'stop'`.                                                               |
| `setShutdownTimeout(timeout: number): void`                            | Positive finite milliseconds.                                                                     |
| `setCustomExitCode(code: number): void`                                | Numeric safe integer overriding every shutdown exit path.                                         |

TypeScript exports `Handler`, `HandlerEntry`, `PhaseEntry`, and `RegisterHandlerOptions`. `Handler` is `(signal: string | number | Error) => Promise<void> | void`. Custom events should supply a matching argument in TypeScript; JavaScript can supply other values or no argument (`undefined`).

## Diagnostics

Set `DEBUG` before import, for example `DEBUG=shutdown-cleanup node server.mjs` in a POSIX shell; use your shell's equivalent elsewhere. Logs use `console.debug` with a `shutdown-cleanup` prefix. Matching accepts any value containing `shutdown-cleanup` or exactly `*`; it is not the `debug` package's namespace/exclusion syntax, so even `-shutdown-cleanup` matches. Errors and timeout warnings always log.

Explicit identifiers make logs, `listHandlers()`, and `removeHandler(identifier)` easier to use. Keep cleanup idempotent where possible and avoid `process.exit()` inside handlers unless intentionally bypassing subsequent cleanup.

## Compatibility and migration

Version 8 raised the consumer minimum from Node.js 18 to **22.0.0**. Upgrade deployment and local runtimes before upgrading; transpiling imports alone does not supply iterator helpers or `Array.prototype.toSorted`. Phase strings/fractions are no longer coerced; timeouts must be positive finite numbers and exit codes numeric safe integers. Failed terminating signal-specific handlers now proceed to phases under `continue`. See the [v7.0.1–v8.0.0 history](https://github.com/hypercliq/shutdown-cleanup/compare/v7.0.1...v8.0.0).

Changes after the [v8.0.3 release](https://github.com/hypercliq/shutdown-cleanup/releases/tag/v8.0.3) also affect callers:

- Registration rejects non-object options (including functions/arrays), non-string identifiers/signals, `phase: null`, non-boolean termination flags, and flags without a signal. Use the types in the API reference; omitted values or `undefined` select defaults. Invalid registrations no longer leave partial registry/listener changes.
- `signal: ''` now selects the empty-name event rather than phased cleanup. Omit `signal` to select phases. Empty identifiers, inherited options, and ignored extra keys remain accepted.
- Late registrations no longer join active cleanup, including those created by a terminating signal-specific handler. Pending removals remain supported; empty future phases are safely skipped.
- Terminating signal-specific handlers now share the guard and deadline with phases. Budget for their runtime; use `shouldTerminate: false` for repeatable actions. Phase/registration order and exit-code conventions are unchanged.

For pre-v7 code, replace positional identifier/phase arguments and `registerSignalHandler` with `registerHandler(handler, options)`. See [release history](https://github.com/hypercliq/shutdown-cleanup/releases) for older changes.

### GitHub Packages retirement

From **6 October 2026**, new releases publish only to npm. **8.0.3** is the final GitHub Packages release; existing versions remain available. Update your project's `.npmrc` and refresh registry URLs in its lockfile:

```ini
@hypercliq:registry=https://registry.npmjs.org/
```

Check other `@hypercliq` dependencies before changing this scope-wide mapping. Version **8.0.0** exists only on GitHub Packages; retain its registry or test a compatible npm version.
