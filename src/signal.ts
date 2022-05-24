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
 * Default signals to listen to.
 */
export const signals: Set<SignalsEvents> = new Set([
  'SIGTERM',
  'SIGHUP',
  'SIGINT',
  'exit',
] as SignalsEvents[])
