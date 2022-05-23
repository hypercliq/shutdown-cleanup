import { constants } from 'os'
import { handlers } from './handler'
import { logger } from './logger'
import { signals, SignalsEvents } from './signal'

export const shutdown = (signal: SignalsEvents | Error | number): void => {
  if (signal === 0x99) {
    logger('Shutdown already in progress')
    return
  }

  logger('Shutting down on', signal)

  Promise.all(handlers.map((h) => h(signal)))
    .then(() => {
      logger('Shutdown completed')

      const exitCode: number = getExitCode(signal)

      logger('Shutdown exitCode:', exitCode)

      process.exit(exitCode)
    })
    .catch((err) => {
      console.error('Error during shutdown:', err)
      process.exit(0x99)
    })
}

export const attachListenerForEvent = (event: SignalsEvents): NodeJS.Process =>
  process
    .removeAllListeners(event)
    .addListener(event as NodeJS.Signals, shutdown)

const getExitCode = (signal: SignalsEvents | Error | number): number => {
  if (typeof signal === 'number') return signal

  if (signal instanceof Error) return (signal as NodeJS.ErrnoException).errno

  return constants.signals[signal as NodeJS.Signals] ?? 0x99
}

signals.forEach(attachListenerForEvent)
