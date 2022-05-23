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

      const exitCode: number =
        typeof signal === 'number'
          ? signal
          : (signal as NodeJS.ErrnoException)?.errno ??
            constants.signals[signal as NodeJS.Signals]

      logger('Shutdown exitCode:', exitCode)

      process.exit(exitCode ?? 0x99)
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

signals.forEach(attachListenerForEvent)
