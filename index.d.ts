type Handler = (signal: string | number | Error) => Promise<void> | void

interface RegisterHandlerOptions {
  /**
   * An optional identifier for the handler. A random identifier is generated if not provided.
   */
  identifier?: string
  /**
   * The phase during which the handler should be executed. Defaults to phase 1.
   * Cannot be used together with `signal`.
   */
  phase?: number
  /**
   * The signal to listen for. If specified, registers a signal-specific handler.
   * Cannot be used together with `phase`.
   */
  signal?: string
  /**
   * For signal-specific handlers, indicates whether the application should terminate after the handler executes.
   * Defaults to `true`.
   */
  shouldTerminate?: boolean
}

interface HandlerEntry {
  identifier: string
  type: 'phase' | 'signal'
  handler: Handler
  /**
   * For signal-specific handlers, the signal being listened to.
   */
  signal?: string
  /**
   * For signal-specific handlers, indicates whether the application should terminate after the handler executes.
   */
  shouldTerminate?: boolean
}

interface PhaseEntry {
  phaseKey: number | 'signal'
  handlers: HandlerEntry[]
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
 * @returns An array of phase entries containing handlers.
 * @example
 * const handlers = listHandlers();
 */
export function listHandlers(): PhaseEntry[]

/**
 * Provides a list of all signals currently being listened to by the module.
 * @param options Optional parameter to include signals from signal-specific handlers.
 * @returns An array of signal names.
 * @example
 * const signals = listSignals({ includeSignalHandlers: true });
 */
export function listSignals(options?: {
  includeSignalHandlers?: boolean
}): string[]

/**
 * Registers a handler to be executed during the shutdown process or when a specific signal is received.
 * @param handler The handler function to execute, which can be async.
 * @param options Options to configure the handler registration.
 * @returns The identifier of the registered handler.
 * @example
 * // Register a generic handler for phase 2
 * const id = registerHandler(async () => console.log('Cleanup tasks'), { identifier: 'cleanupHandler', phase: 2 });
 *
 * // Register a signal-specific handler
 * const id = registerHandler(async () => console.log('Handling SIGUSR2'), { identifier: 'sigusr2Handler', signal: 'SIGUSR2', shouldTerminate: false });
 */
export function registerHandler(
  handler: Handler,
  options?: RegisterHandlerOptions,
): string

/**
 * Removes a previously registered handler by its identifier.
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
