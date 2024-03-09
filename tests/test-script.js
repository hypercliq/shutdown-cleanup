import {
  addSignal,
  registerHandler,
  registerSignalHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '../src/index.js'

const arguments_ = process.argv.slice(2)
const argument = arguments_[0]

switch (argument) {
  case '--default': {
    {
      const defaultSignal = arguments_[1]
      registerHandler(async () => {
        console.error(`Handled default signal: ${defaultSignal}`)
      })

      process.kill(process.pid, defaultSignal === 'exit' ? 0 : defaultSignal)
    }
    break
  }
  case '-s': {
    {
      const signal = arguments_[1]
      registerSignalHandler(signal, async () => {
        console.error(`Handled signal: ${signal}`)
      })

      process.kill(process.pid, signal)
    }
    break
  }
  case '-l': {
    {
      const event = arguments_[1]
      // eslint-disable-next-line unicorn/prefer-top-level-await
      handleLifecycleEvent(event)
    }
    break
  }
  case '-e': {
    {
      const strategy = arguments_[1]
      setErrorHandlingStrategy(strategy)

      // eslint-disable-next-line unicorn/consistent-function-scoping
      const failingHandler = async () => {
        throw new Error('Some error')
      }

      // eslint-disable-next-line unicorn/consistent-function-scoping
      const succeedingHandler = async () => {
        console.log('Handler for succeed')
      }
      registerHandler(failingHandler)
      registerHandler(succeedingHandler, 'succeed', 2)
    }
    break
  }
  case '-t': {
    {
      const timeout = arguments_[1]
      setShutdownTimeout(Number(timeout))

      // eslint-disable-next-line unicorn/consistent-function-scoping
      const longHandler = async () => {
        return new Promise((resolve) => {
          const delay = Number(timeout) * 2
          setTimeout(resolve, delay)
        })
      }

      registerHandler(longHandler)
      process.kill(process.pid, 'SIGTERM')
    }
    break
  }
  case '-x': {
    {
      const exitCode = arguments_[1]
      setCustomExitCode(Number(exitCode))
      registerHandler(async () => {
        console.log('Handler for exit')
      })
    }
    break
  }
  case '-c': {
    {
      const customSignal = arguments_[1]
      const customExitCode = arguments_[2]
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
    console.error('Unknown argument:', argument)
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
  // simulate some process running to give a chance
  // to the signals to propagate
}, 100)
