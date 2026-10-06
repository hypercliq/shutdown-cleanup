/**
 * Importing this ESM module immediately attaches process listeners for SIGTERM,
 * SIGHUP, SIGINT, and beforeExit, even without handlers. Other application
 * listeners remain attached. Shutdown explicitly calls process.exit after cleanup.
 * beforeExit requires a drained event loop; open servers can prevent it. Explicit
 * process.exit and uncaught exceptions bypass it; exit cannot await async cleanup.
 * DEBUG is read at import time: a value containing "shutdown-cleanup" or exactly
 * "*" enables console.debug logging (not debug-package namespace matching).
 * The @example snippets are schematic API usage and assume named functions have
 * been imported; see DEVGUIDE.md for a standalone runnable HTTP server example.
 */

/**
 * Return a Promise that settles only when cleanup finishes. Callback APIs such as
 * Node HTTP server.close require a Promise wrapper; awaiting the server itself
 * does not await closure. Receives the first process-event argument, normally a
 * signal name or the numeric beforeExit code. Custom events must supply a value
 * matching this type; runtime events can emit undefined or other argument types.
 */
export type Handler = (signal: string | number | Error) => Promise<void> | void

export type ErrorHandlingStrategy = 'continue' | 'stop'

export interface BaseRegisterHandlerOptions {
  /**
   * An optional unique string identifier for the handler; an empty string is valid.
   * An identifier is generated if omitted or undefined.
   */
  identifier?: string
}

export interface PhaseRegisterHandlerOptions extends BaseRegisterHandlerOptions {
  /**
   * A positive safe integer phase during which the handler should be executed.
   * Defaults to phase 1 if omitted or undefined.
   * Lower phases run first; handlers within each phase are awaited sequentially
   * in registration order. Cannot be used together with `signal`.
   */
  phase?: number
  signal?: never
  shouldTerminate?: never
}

export interface SignalRegisterHandlerOptions extends BaseRegisterHandlerOptions {
  /**
   * The signal or process event name to listen for. Any string, including an empty
   * event name, registers a signal-specific handler. SIGKILL and SIGSTOP are rejected.
   * Cannot be used together with `phase`.
   */
  signal: string
  /**
   * For signal-specific handlers, indicates whether the application should terminate after the handler executes.
   * When true, the handler runs before phases under one shutdown guard and deadline.
   * Further terminating events are ignored, including other terminating signal handlers.
   * When false, the handler remains repeatable even during shutdown, can overlap
   * on repeated events, and does not start a shutdown timer. Errors still follow
   * the global strategy; stop exits on failure.
   * Defaults to `true`.
   */
  shouldTerminate?: boolean
  phase?: never
}

export type RegisterHandlerOptions =
  PhaseRegisterHandlerOptions | SignalRegisterHandlerOptions

export interface PhaseHandlerEntry {
  identifier: string
  type: 'phase'
  handler: Handler
}

export interface SignalHandlerEntry {
  identifier: string
  type: 'signal'
  handler: Handler
  signal: string
  shouldTerminate: boolean
}

export type HandlerEntry = PhaseHandlerEntry | SignalHandlerEntry

export interface PhaseEntry {
  phaseKey: number | 'signal'
  handlers: HandlerEntry[]
}

export interface ListSignalsOptions {
  includeSignalHandlers?: boolean
}

/**
 * Adds a new signal to be listened for, initiating the shutdown process when received.
 * @param signal The name of the signal to add.
 * @returns `true` if the signal was added successfully, `false` if it was already present or has a specific handler.
 * @example
 * addSignal('SIGUSR2');
 */
export function addSignal(signal: string): boolean

/**
 * Lists all registered handlers, including both generic (phase) and signal-specific handlers.
 * Entries are sorted by phase, with the signal group first as phaseKey: 'signal'.
 * Signal entries expose metadata but omit the internal process listener.
 * @returns An array of phase entries containing handlers.
 * @example
 * const handlers = listHandlers();
 */
export function listHandlers(): PhaseEntry[]

/**
 * Lists this module's general shutdown signals/events; excludes signal-specific
 * registrations unless includeSignalHandlers is true (including non-terminating ones).
 * @param options Optional parameter to include signals from signal-specific handlers.
 * @returns An array of signal names.
 * @example
 * const signals = listSignals({ includeSignalHandlers: true });
 */
export function listSignals(options?: ListSignalsOptions): string[]

/**
 * Registers a handler to be executed during the shutdown process or when a specific signal is received.
 * Phases run in ascending order and each handler is awaited sequentially in
 * registration order within its phase.
 * Phased handlers are snapshotted when shutdown starts, before any terminating signal-specific handler.
 * Registrations made after that point are accepted but excluded from the active phased cleanup.
 * Inputs are validated before registry or process listener changes. Rejected registrations
 * leave handler lists, signal lists, and process listeners unchanged.
 * In JavaScript, options must be a non-null object excluding arrays; inherited properties
 * are supported and extra keys are ignored. Undefined optional values use their defaults.
 * @throws {TypeError} For a non-function handler, malformed options, or incorrect option value types.
 * @throws {Error} For an invalid phase, incompatible options, duplicate identifier or signal, or uncatchable signal.
 * @param handler The handler function to execute, which can be async.
 * @param options Options to configure the handler registration.
 * @returns The identifier of the registered handler.
 * @example
 * // Register a generic handler for phase 2
 * const id = registerHandler(async () => console.log('Cleanup tasks'), { identifier: 'cleanupHandler', phase: 2 });
 *
 * // Register a signal-specific handler
 * const signalId = registerHandler(async () => console.log('Handling SIGUSR2'), { identifier: 'sigusr2Handler', signal: 'SIGUSR2', shouldTerminate: false });
 */
export function registerHandler(
  handler: Handler,
  options?: RegisterHandlerOptions,
): string

/**
 * Removes a previously registered handler by its identifier. Removing a signal
 * handler detaches its listener and restores this module's default listener if
 * that registration had replaced it.
 * During shutdown, removed pending handlers are skipped; an invocation already in progress still completes.
 * Re-registering the same identifier does not restore its place in the active shutdown snapshot.
 * @param identifier The identifier of the handler to remove.
 * @returns `true` if the handler was successfully removed, `false` otherwise.
 * @example
 * removeHandler('cleanupHandler');
 */
export function removeHandler(identifier: string): boolean

/**
 * Removes only this module's general shutdown listener for a signal/event.
 * Does not remove signal-specific registrations or other application listeners.
 * @param signal The signal to remove.
 * @returns `true` if the signal was successfully removed, `false` otherwise.
 * @example
 * removeSignal('SIGUSR2');
 */
export function removeSignal(signal: string): boolean

/**
 * Sets a numeric safe integer exit code, overriding normal completion, timeout,
 * and stop-on-error exits, including code 0. No 0-255 range restriction is applied.
 * Without an override, completion uses a safe integer event argument, Error.errno
 * when non-nullish, or os.constants.signals for a signal name (without adding 128),
 * falling back to 1. Timeout and stop-on-error use 1. Errors under continue do not
 * change the completion code. Node/OS exit-status behavior still applies.
 * @param code The custom exit code to be used.
 * @example
 * setCustomExitCode(0);
 */
export function setCustomExitCode(code: number): void

/**
 * Sets the global error handling strategy for phase and signal-specific handlers.
 * Defaults to continue: log the error and proceed, without changing the exit code.
 * stop exits immediately with the custom code if set, otherwise 1.
 * @param strategy The error handling strategy, either 'continue' or 'stop'.
 * @example
 * setErrorHandlingStrategy('continue');
 */
export function setErrorHandlingStrategy(strategy: ErrorHandlingStrategy): void

/**
 * Sets the timeout for the shutdown process. If the shutdown does not complete within this timeframe, the process is forcefully terminated.
 * One deadline covers the terminating signal-specific handler, if any, and all subsequent phased cleanup.
 * Starting phased cleanup does not reset the deadline.
 * Handlers with `shouldTerminate: false` do not start this deadline.
 * Uses Node.js timers: event-loop blocking can delay termination, and OS termination can bypass cleanup.
 * Defaults to 30000 ms. Requires a positive finite number; Node timer delay
 * normalization applies. Timeout exits with the custom code if set, otherwise 1.
 * @param timeout The timeout in milliseconds.
 * @example
 * setShutdownTimeout(5000);
 */
export function setShutdownTimeout(timeout: number): void
