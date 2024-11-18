type Handler = (signal: string) => Promise<void> | void

type SignalHandler = {
  handler: Handler
  shouldTerminate: boolean
  listener: () => void
}

type Handlers = Record<number, Record<string, Handler>>
type SignalHandlers = Record<string, SignalHandler>

/**
 * Adds a new signal to be listened for, initiating the shutdown process when received.
 * @param signal The name of the signal to add.
 * @returns `true` if the signal was added successfully, `false` if it was already present.
 * @example
 * addSignal('SIGUSR2');
 */
export function addSignal(signal: string): boolean

/**
 * Lists all registered handlers, including both shutdown and signal-specific handlers.
 * @returns An object with all registered handlers.
 * @example
 * const handlers = listHandlers();
 */
export function listHandlers(): Handlers & SignalHandlers

/**
 * Provides a list of all signals currently being listened to by the module.
 * @returns An array of signal names.
 * @example
 * const signals = listSignals();
 */
export function listSignals(): string[]

/**
 * Registers a shutdown handler to be executed during the shutdown process.
 * Handlers can be assigned to specific phases for ordered execution.
 * @param handler The handler function to execute, which can be async.
 * @param identifier An optional identifier for the handler. A random identifier is generated if not provided.
 * @param phase The phase during which the handler should be executed. Defaults to phase 1.
 * @example
 * registerHandler(async () => console.log('Cleanup tasks'), 'cleanupHandler', 2);
 */
export function registerHandler(
  handler: Handler,
  identifier?: string,
  phase?: number,
): void

/**
 * Registers a signal-specific handler that executes custom logic when the specified signal is received.
 * @param signal The signal to listen for.
 * @param handler The handler function to execute when the signal is received, which can be async.
 * @param shouldTerminate Optional flag indicating whether the application should terminate after the handler executes. Defaults to `true`.
 * @example
 * registerSignalHandler('SIGUSR2', async () => console.log('Handling SIGUSR2'), false);
 */
export function registerSignalHandler(
  signal: string,
  handler: Handler,
  shouldTerminate?: boolean,
): void

/**
 * Removes a previously registered shutdown handler by its identifier.
 * @param identifier The identifier of the handler to remove.
 * @returns `true` if the handler was successfully removed, `false` otherwise.
 * @example
 * removeHandler('cleanupHandler');
 */
export function removeHandler(identifier: string): boolean

/**
 * Removes a signal from the list that initiates the shutdown process.
 * @param signal The signal to remove.
 * @returns `true` if the signal was successfully removed, `false` otherwise.
 * @example
 * removeSignal('SIGUSR2');
 */
export function removeSignal(signal: string): boolean

/**
 * Removes a previously registered signal-specific handler.
 * @param signal The signal whose handler is to be removed.
 * @returns `true` if the handler was successfully removed, `false` otherwise.
 * @example
 * removeSignalHandler('SIGUSR2');
 */
export function removeSignalHandler(signal: string): boolean

/**
 * Sets a custom exit code for the shutdown process, overriding the default exit code.
 * @param code The custom exit code to be used.
 * @example
 * setCustomExitCode(0);
 */
export function setCustomExitCode(code: number): void

/**
 * Sets the global error handling strategy during the shutdown process.
 * @param strategy The error handling strategy, either 'continue' or 'stop'.
 * @example
 * setErrorHandlingStrategy('continue');
 */
export function setErrorHandlingStrategy(strategy: 'continue' | 'stop'): void

/**
 * Sets the timeout for the shutdown process. If the shutdown does not complete within this timeframe, the process is forcefully terminated.
 * @param timeout The timeout in milliseconds.
 * @example
 * setShutdownTimeout(5000);
 */
export function setShutdownTimeout(timeout: number): void
