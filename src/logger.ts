const { DEBUG } = process.env

/**
 * comaptibility with the `debug` package (https://www.npmjs.com/package/debug) without the dependency.
 */
const enabled = DEBUG && /(?:shutdown-cleanup|^\*$)/.test(DEBUG)

/**
 * Log a debug message message
 *
 * @param message the debug message to show
 */
export const logger = (...message: unknown[]): void => {
  if (enabled) console.debug('🐞shutdown-cleanup', ...message)
}
