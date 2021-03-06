import * as os from 'os'
import { HandlerFunction } from './HandlerFunction'
import { SignalsEvents } from './SignalsEvents'

const { DEBUG } = process.env

const enabled = DEBUG && /(?:^shutdown-cleanup$|^\*$)/.test(DEBUG)

export const logger = (...message: unknown[]): void => {
  if (enabled) console.debug('🐞shutdown-cleanup', ...message)
}

export const signals: Set<SignalsEvents> = new Set([
  'SIGTERM',
  'SIGHUP',
  'SIGINT',
  'exit',
])

export const handlers: HandlerFunction[] = []

let shuttingDown = false

export const shutdown = async (
  signal: SignalsEvents | Error
): Promise<void> => {
  if (shuttingDown) {
    return
  }
  shuttingDown = true

  logger('Shutting down on', signal)

  await Promise.all(handlers.map((h) => h(signal)))

  logger('Shutdown completed')

  const exitCode =
    typeof signal === 'number'
      ? signal
      : signal instanceof Error
      ? (signal as NodeJS.ErrnoException).errno
      : os.constants.signals[signal as NodeJS.Signals]

  logger('Shutdown exitCode:', exitCode)

  process.exit(exitCode ?? 1)
}

export const attachListenerForEvent = (event: SignalsEvents): NodeJS.Process =>
  process
    .removeAllListeners(event)
    .addListener(event as NodeJS.Signals, shutdown)

signals.forEach(attachListenerForEvent)
