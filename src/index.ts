import { attachListenerForEvent, shutdown } from './core'
import { HandlerFunction, handlers } from './handler'
import { logger } from './logger'
import { signals, SignalsEvents } from './signal'

/**
 * Register a handler function to run at shutdown.
 *
 * @param {HandlerFunction} handler
 * @memberof ShutdownCleanup
 */
export const registerHandler = (handler: HandlerFunction): void => {
  handlers.push(handler)
  logger('Handler:', handler.toString())
}

/**
 * Add a shutdown signal/event to listen to.
 *
 * @param {SignalsEvents} signal
 * @returns {boolean} `true` if the signal was added
 * @memberof ShutdownCleanup
 */
export const addSignal = (signal: SignalsEvents): boolean => {
  if (signals.has(signal)) return false
  signals.add(signal)
  attachListenerForEvent(signal)
  logger('Added signal:', signal)
  return true
}

/**
 * Remove a shutdown signal/event to listen to.
 *
 * @param {SignalsEvents} signal
 * @returns {boolean} `true` if the signal was removed
 * @memberof ShutdownCleanup
 */
export const removeSignal = (signal: SignalsEvents): boolean => {
  if (signals.delete(signal)) {
    process.removeListener(signal, shutdown)
    logger('Removed signal:', signal)
    return true
  }
  return false
}

/**
 * Returns an array of SignalsEvents currently listened to.
 *
 * @returns {SignalsEvents[]} an array of `SignalsEvents`
 * @memberof ShutdownCleanup
 */
export const listSignals = (): readonly SignalsEvents[] => {
  return Array.from(signals)
}
