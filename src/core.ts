import { constants } from 'os'
import { handlers } from './handler'
import { logger } from './logger'
import { signals, SignalsEvents } from './signal'

const DEFAULT_EXIT_CODE = 0x99

export const shutdown = async (
  signal: SignalsEvents | NodeJS.ErrnoException | number
): Promise<void> => {
  if (signal === DEFAULT_EXIT_CODE) {
    logger('Shutdown already in progress')
    return
  }

  logger('Shutting down on', signal)

  for (const handler of handlers) {
    try {
      await handler(signal)
    } catch (error) {
      console.log('Error in shutdown handler', error)
    }
  }

  logger('Shutdown completed')

  const exitCode: number = getExitCode(signal)

  logger('Shutdown exitCode:', exitCode)

  process.exit(exitCode)
}

export const attachListenerForEvent = (event: SignalsEvents): NodeJS.Process =>
  process
    .removeAllListeners(event)
    .addListener(event as NodeJS.Signals, shutdown)

const getExitCode = (
  signal: SignalsEvents | NodeJS.ErrnoException | number
): number => {
  let code: number

  if (typeof signal === 'number') {
    code = signal
  } else if (signal instanceof Error) {
    code = signal.errno
  } else {
    code = constants.signals[signal]
  }

  return code ?? DEFAULT_EXIT_CODE
}

// attach shutdown listeners to all the signals
signals.forEach(attachListenerForEvent)
