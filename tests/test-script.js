import process from 'node:process'
import {
  addSignal,
  registerHandler,
  registerSignalHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '../index.js'

const [flag, ...rest] = process.argv.slice(2)

const succeedingHandler = async () => {
  console.log('Handler for succeed')
}

const failingHandler = async () => {
  throw new Error('Some error')
}

switch (flag) {
  case '--default': {
    {
      const defaultSignal = rest[0]
      registerHandler(async () => {
        console.error(`Handled default signal: ${defaultSignal}`)
      })

      process.kill(process.pid, defaultSignal === 'exit' ? 0 : defaultSignal)
    }

    break
  }

  case '-s': {
    {
      const signal = rest[0]
      registerSignalHandler(signal, async () => {
        console.error(`Handled signal: ${signal}`)
      })

      process.kill(process.pid, signal)
    }

    break
  }

  case '-l': {
    {
      const event = rest[0]
      await handleLifecycleEvent(event)
    }

    break
  }

  case '-e': {
    {
      const strategy = rest[0]
      setErrorHandlingStrategy(strategy)

      // Explicitly set the identifier for the failing handler
      registerHandler(failingHandler, 'failingHandler', 1)
      registerHandler(succeedingHandler, 'succeed', 2)
    }

    break
  }

  case '-t': {
    {
      const timeout = rest[0]
      setShutdownTimeout(Number(timeout))

      // Register a handler that takes longer than the timeout
      registerHandler(
        async () =>
          new Promise((resolve) => {
            const delay = Number(timeout) * 2
            setTimeout(resolve, delay)
          }),
      )
      process.kill(process.pid, 'SIGTERM')
    }

    break
  }

  case '-x': {
    {
      const exitCode = rest[0]
      setCustomExitCode(Number(exitCode))
      registerHandler(async () => {
        console.log('Handler for exit')
      })
    }

    break
  }

  case '-c': {
    {
      const customSignal = rest[0]
      const customExitCode = rest[1]
      setCustomExitCode(Number(customExitCode))
      registerSignalHandler(customSignal, async () => {
        console.error(`Handled signal: ${customSignal}`)
      })
      process.emit(customSignal, Number(customExitCode))
    }

    break
  }

  case '--multi-phase': {
    registerHandler(async () => {
      console.error('Handler for phase 1')
    })
    registerHandler(
      async () => {
        console.error('Handler for phase 2')
      },
      'phase2',
      2,
    )
    break
  }

  default: {
    console.error('Unknown flag:', flag)
  }
}

async function handleLifecycleEvent(event) {
  switch (event) {
    case 'unhandled': {
      addSignal('unhandledRejection')
      registerHandler(async (signal) => {
        console.error(`Handler for unhandledRejection: ${signal}`)
      })
      Promise.reject(new Error('Unhandled rejection'))
      break
    }

    case 'uncaught': {
      addSignal('uncaughtException')
      registerHandler(async (signal) => {
        console.error(`Handler for uncaughtException: ${signal}`)
      })
      throw new Error('Uncaught exception')
    }

    case 'beforeExit': {
      addSignal('beforeExit')
      registerHandler(async (signal) => {
        console.log(`Handler for beforeExit: ${signal}`)
      })
      break
    }

    default: {
      console.error('Unknown event:', event)
    }
  }
}

setTimeout(() => {
  // Simulate some process running to give a chance
  // to the signals to propagate
}, 200)
