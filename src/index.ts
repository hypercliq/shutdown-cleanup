import debug from 'debug'
import os from 'os'

/**
 * API type
 *
 * These are the types accepted by `process.addListener()` and should be the types
 * accepted by `addSignal()` and `removeSignal()`
 */
type SignalsEvents =
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

const logger = debug('shutdown-cleanup')

const signals: Set<any> = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'exit'])

const handlers: Function[] = []

let shuttingDown = false

const shutdown = async (signal: any) => {
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
  static registerHandler (handler: Function) {
    handlers.push(handler)
    logger('Handler:', handler.toString())
  }

  /**
   * Add a shutdown signal/event to listen to.
   *
   * @static
   * @param {SignalsEvents} signal
   * @memberof ShutdownCleanup
   */
  static addSignal (signal: SignalsEvents) {
    signals.add(signal)
    attachListenerForEvent(signal)
    logger('Added signal:', signal)
  }

  /**
   * Remove a shutdown signal/event to listen to.
   *
   * @static
   * @param {SignalsEvents} signal
   * @memberof ShutdownCleanup
   */
  static removeSignal (signal: SignalsEvents) {
    if (signals.delete(signal)) {
      process.removeListener(signal, shutdown)
      logger('Removed signal:', signal)
    }
  }
}
