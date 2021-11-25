import * as utils from './core'
import { HandlerFunction, handlers } from './handler'
import * as DEBUG from './logger'
import { signals, SignalsEvents } from './signal'

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
   * @param {HandlerFunction} handler
   * @memberof ShutdownCleanup
   */
  static registerHandler(handler: HandlerFunction): void {
    handlers.push(handler)
    DEBUG.logger('Handler:', handler.toString())
  }

  /**
   * Add a shutdown signal/event to listen to.
   *
   * @static
   * @param {SignalsEvents} signal
   * @returns {boolean} `true` if the signal was added
   * @memberof ShutdownCleanup
   */
  static addSignal(signal: SignalsEvents): boolean {
    if (signals.has(signal)) return false
    signals.add(signal)
    utils.attachListenerForEvent(signal)
    DEBUG.logger('Added signal:', signal)
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
  static removeSignal(signal: SignalsEvents): boolean {
    if (signals.delete(signal)) {
      process.removeListener(signal, utils.shutdown)
      DEBUG.logger('Removed signal:', signal)
      return true
    }
    return false
  }

  /**
   * Returns an array of SignalsEvents currently listened to.
   *
   * @static
   * @returns {SignalsEvents[]} an array of `SignalsEvents`
   * @memberof ShutdownCleanup
   */
  static listSignals(): SignalsEvents[] {
    return Array.from(signals)
  }
}
