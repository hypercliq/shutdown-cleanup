import debug from 'debug'
import os from 'os'

/**
 * API type
 *
 * These are the types accepted by `process.addListener()` and should be the types
 * accepted by `addSignal()` and `removeSignal()`
 */
export type SignalsEvents =
  | 'beforeExit'
  | 'disconnect'
  | 'exit'
  | 'rejectionHandled'
  | 'uncaughtException'
  | 'unhandledRejection'
  | 'warning'
  | 'message'
  | 'newListener'
  | 'removeListener'
  | 'multipleResolves'
  | NodeJS.Signals

/**
 * The handler function
 *
 * @export
 * @interface HandlerFunction
 */
export interface HandlerFunction {
  (signal?: SignalsEvents | Error): any
}

const logger = debug('shutdown-cleanup')

const signals: Set<SignalsEvents> = new Set([
  'SIGTERM',
  'SIGHUP',
  'SIGINT',
  'exit'
])

const handlers: HandlerFunction[] = []

let shuttingDown = false

const shutdown = async (signal: SignalsEvents | Error) => {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  logger('Shutting down on', signal)

  await Promise.all(handlers.map(h => h(signal)))

  logger('Shutdown completed')

  const exitCode =
    typeof signal === 'number'
      ? signal
      : signal instanceof Error
      ? (signal as NodeJS.ErrnoException).errno
      : os.constants.signals[signal as NodeJS.Signals]

  // should not exit with 0
  process.exit(!exitCode || exitCode === 0 ? 1 : exitCode)
}

const attachListenerForEvent = (event: any) =>
  process.removeAllListeners(event).addListener(event, shutdown)

signals.forEach(attachListenerForEvent)

/**
 * Allows to register handlers for certain shutdown signals/events
 * in order to attempt a graceful shutdown.
 *
 * NOTE: it removes any previous registered listeners for the given signals!
 *
 * By default it listens to:
 * `SIGTERM`
 * `SIGHUP`
 * `SIGINT`
 *
 * It also listens to the `exit` event, but keep in mind that `exit` does
 * not allow asynchrounous listeners' operations to complete.
 * https://nodejs.org/dist/latest/docs/api/process.html#process_event_exit
 *
 * It is also possible to add (or remove) other shutdown signals and events.
 *
 * @export
 * @class ShutdownCleanup
 */
export class ShutdownCleanup {
  /**
   * Register a handler function to run at shutdown.
   *
   * @static
   * @param {Function} handler
   * @memberof ShutdownCleanup
   */
  static registerHandler (handler: HandlerFunction) {
    handlers.push(handler)
    logger('Handler:', handler.toString())
  }

  /**
   * Add a shutdown signal/event to listen to.
   *
   * @static
   * @param {SignalsEvents} signal
   * @returns {boolean} `true` if the signal was added
   * @memberof ShutdownCleanup
   */
  static addSignal (signal: SignalsEvents): boolean {
    if (signals.has(signal)) return false
    signals.add(signal)
    attachListenerForEvent(signal)
    logger('Added signal:', signal)
    return true
  }

  /**
   * Remove a shutdown signal/event to listen to.
   *
   * @static
   * @param {SignalsEvents} signal
   * @returns {boolean} `true` if the signal was removed
   * @memberof ShutdownCleanup
   */
  static removeSignal (signal: SignalsEvents): boolean {
    if (signals.delete(signal)) {
      process.removeListener(signal, shutdown)
      logger('Removed signal:', signal)
      return true
    }
    return false
  }
}
