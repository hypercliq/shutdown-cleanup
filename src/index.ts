import debug from 'debug'

const logger = debug('node-shut-down')

const signals: Set<any> = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'exit'])

const handlers: Function[] = []

let shuttingDown = false

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  logger('Shutting down on', signal)

  await Promise.all(handlers.map(h => h()))

  logger('Shutdown completed')
}

const resetSignals = () => {
  signals.forEach(event => {
    process.removeAllListeners(event).addListener(event, shutdown)
  })
}

resetSignals()

/**
 * Allows to register handlers for certain shutdown signals
 * in order to attempt a graceful shutdown.
 *
 * NOTE: it removes any previous registered listeners for the given signals!
 *
 * By default it listens to:
 * `SIGTERM`
 * `SIGHUP`
 * `SIGINT`
 *
 * It also listens to `process.exit` but keep in mind that `exit` does
 * not allow asynchrounous listeners' operations to complete.
 * https://nodejs.org/dist/latest/docs/api/process.html#process_event_exit
 *
 * It is also possible to add (or remove) other shutdown signals.
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
   * Add a shutdown signal to listen to.
   *
   * @static
   * @param {string} signal
   * @memberof ShutdownCleanup
   */
  static addSignal (signal: string) {
    signals.add(signal)
    resetSignals()
    logger('Added signal:', signal)
  }

  /**
   * Remove a shutdown signal to listen to.
   *
   * @static
   * @param {string} signal
   * @memberof ShutdownCleanup
   */
  static removeSignal (signal: string) {
    signals.delete(signal)
    resetSignals()
    logger('Removed signal:', signal)
  }
}
