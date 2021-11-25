const { DEBUG } = process.env
const enabled = DEBUG && /(?:^shutdown-cleanup$|^\*$)/.test(DEBUG)

export const logger = (...message: unknown[]): void => {
  if (enabled) console.debug('🐞shutdown-cleanup', ...message)
}
