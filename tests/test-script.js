import process from 'node:process'
import {
  addSignal,
  listHandlers,
  listSignals,
  registerHandler,
  removeHandler,
  removeSignal,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '../index.js'

const [flag, ...rest] = process.argv.slice(2)

const handleLifecycleEvent = async (event) => {
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

const handleHandlerRegistration = (action, parameters) => {
  switch (action) {
    case 'remove-it': {
      {
        const results = {}
        const identifier = parameters[0]
        const signal = parameters[1]
        const includeSignalHandlers = parameters[2] ?? false

        results.identifier = signal
          ? registerHandler(() => {}, {
              identifier,
              signal,
              shouldTerminate: true,
            })
          : registerHandler(() => {}, {
              identifier,
            })

        results.listBefore = listHandlers()
        results.signalsBefore = listSignals({
          includeSignalHandlers: true,
        }).includes(signal)
        results.removed = removeHandler(identifier)
        results.listAfter = listHandlers()
        results.signalsAfter = listSignals({
          includeSignalHandlers: includeSignalHandlers,
        }).includes(signal)

        console.log(JSON.stringify(results))
      }

      break
    }

    case 'remove-non-existent': {
      {
        const results = {}

        registerHandler(() => {}, {
          identifier: 'nonExistentHandler',
        })

        removeHandler('nonExistentHandler')

        results.removed = removeHandler('nonExistentHandler')

        console.log(JSON.stringify(results))
      }

      break
    }

    case 'with-signal-and-phase': {
      // try {
      registerHandler(() => {}, {
        signal: 'SIGTERM',
        phase: 1,
      })
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }

      break
    }

    case 'with-invalid-phase': {
      // try {
      registerHandler(() => {}, {
        phase: 0,
      })
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }

      break
    }

    case 'with-duplicate-identifier': {
      // try {
      const identifier = parameters[0]
      registerHandler(() => {}, {
        identifier: identifier,
      })
      registerHandler(() => {}, {
        identifier: identifier,
      })
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }

      break
    }

    case 'with-uncatchable-signal': {
      // try {
      registerHandler(() => {}, {
        signal: 'SIGKILL',
      })
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }

      break
    }

    default: {
      console.error('Unknown action:', action)
    }
  }
}

const handlePhaseHandling = (phaseType) => {
  switch (phaseType) {
    case 'multi-phase': {
      // Register handler in phase 3
      registerHandler(
        async () =>
          new Promise((resolve) => {
            const delay = 1000
            setTimeout(resolve, delay)
            console.log('Handler for phase 3')
          }),
        {
          phase: 3,
        },
      )

      // Register handler in phase 1
      registerHandler(() => {
        console.log('Handler for phase 1')
      })

      // Register handler in phase 4
      registerHandler(
        () => {
          console.log('Handler for phase 4')
        },
        {
          phase: 4,
        },
      )

      // Register handler in phase 2
      registerHandler(
        async () => {
          console.log('Handler for phase 2')
        },
        {
          phase: 2,
        },
      )

      break
    }

    case 'same-phase': {
      registerHandler(() => {
        console.log('First handler in phase 1')
      })
      registerHandler(() => {
        console.log('Second handler in phase 1')
      })

      break
    }

    default: {
      console.error('Unknown phaseType:', phaseType)
    }
  }
}

switch (flag) {
  case '--handle-default-signal': {
    {
      const defaultSignal = rest[0]
      registerHandler(async () => {
        console.log(`Handled default signal: ${defaultSignal}`)
      })

      defaultSignal === 'beforeExit'
        ? process.emit(defaultSignal, 0)
        : process.kill(process.pid, defaultSignal)
    }

    break
  }

  case '--list-default-signals': {
    {
      const defaultSignals = listSignals()

      console.log(JSON.stringify(defaultSignals))
    }
    break
  }

  case '--register-handler': {
    handleHandlerRegistration(rest[0], rest.slice(1))

    break
  }

  case '--handle-posix-signal': {
    {
      const signal = rest[0]
      registerHandler(
        async () => {
          console.log(`Handled signal: ${signal}`)
        },
        {
          signal,
        },
      )

      process.kill(process.pid, signal)
    }

    break
  }

  case '--node-lifecycle': {
    await handleLifecycleEvent(rest[0])

    break
  }

  case '--add-remove-signal': {
    {
      const results = {}
      const signal = rest[0]
      const duplicate = rest[1]

      // try {
      results.added = addSignal(signal)

      if (duplicate) {
        results.duplicate = addSignal(duplicate)
      }

      results.listBefore = listSignals()
      results.removed = removeSignal(signal)
      results.listAfter = listSignals()
      console.log(JSON.stringify(results))
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }
    }

    break
  }

  case '--strategy': {
    {
      const strategy = rest[0]

      // try {
      setErrorHandlingStrategy(strategy)
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }

      registerHandler(
        () => {
          throw new Error('Something went wrong')
        },
        {
          identifier: 'failingHandler',
        },
      )
      registerHandler(
        () => {
          console.log('Handler for succeed')
        },
        {
          identifier: 'succeedingHandler',
          phase: 2,
        },
      )
    }

    break
  }

  case '--custom-timeout': {
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

  case '--custom-exit-code': {
    {
      const exitCode = rest[0]
      // try {
      setCustomExitCode(Number(exitCode))
      registerHandler(async () => {
        console.log('Handler for exit')
      })
      // } catch (error) {
      //   console.error(error.message)
      //   process.exit(1) // eslint-disable-line unicorn/no-process-exit
      // }
    }

    break
  }

  case '--custom-event': {
    {
      const customSignal = rest[0]
      const customExitCode = rest[1]
      setCustomExitCode(Number(customExitCode))
      registerHandler(
        async () => {
          console.log(`Handled signal: ${customSignal}`)
        },
        {
          signal: customSignal,
        },
      )
      process.emit(customSignal, Number(customExitCode))
    }

    break
  }

  case '--phase-handling': {
    handlePhaseHandling(rest[0])

    break
  }

  default: {
    console.error('Unknown flag:', flag)
  }
}

setTimeout(() => {
  // Simulate some process running to give a chance
  // to the signals to propagate
}, 200)
