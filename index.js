import * as os from 'node:os'
import process from 'node:process'

// Debugging setup
const { DEBUG } = process.env
const enabled = DEBUG && /shutdown-cleanup|^\*$/.test(DEBUG)
const logger = (...message) => {
  if (enabled) {
    console.debug('\uD83D\uDC1Eshutdown-cleanup', ...message)
  }
}

// Using an object to store handlers, with integers as keys
const handlers = {}
// Default error handling strategy: 'continue' or 'stop'
let errorHandlingStrategy = 'continue'

// Utility function to generate random identifiers if not provided
const generateRandomIdentifier = () =>
  `handler_${Math.random().toString(36).slice(2, 11)}`

// Global registry for handler identifiers
const globalHandlerIdentifiers = new Set()

// Register a shutdown handler
const registerHandler = (
  handler,
  identifier = `handler_${Math.random().toString(36).slice(2, 11)}`,
  phase = 1,
) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Handler must be a function')
  }

  // Check if the handler is asynchronous
  const isAsync = handler.constructor.name === 'AsyncFunction'
  if (!isAsync) {
    throw new TypeError(
      'Handler must be an asynchronous function (returning a Promise)',
    )
  }

  const phaseKey = Number.parseInt(phase, 10)
  if (Number.isNaN(phaseKey) || phaseKey < 1) {
    throw new Error('Phase must be a positive integer')
  }

  // Enforce global uniqueness
  if (globalHandlerIdentifiers.has(identifier)) {
    throw new Error(
      `Handler with identifier '${identifier}' already exists globally`,
    )
  }

  handlers[phaseKey] ||= {}

  if (handlers[phaseKey][identifier]) {
    throw new Error(
      `Handler with identifier '${identifier}' already exists in phase '${phaseKey}'`,
    )
  }

  handlers[phaseKey][identifier] = handler
  globalHandlerIdentifiers.add(identifier)
  logger(
    `Handler registered for phase '${phaseKey}', identifier: '${identifier}'`,
  )
}

const removeHandler = (identifier) => {
  for (const phase in handlers) {
    if (handlers[phase][identifier]) {
      delete handlers[phase][identifier]
      globalHandlerIdentifiers.delete(identifier)
      logger(`Removed handler: ${identifier}`)
      return true
    }
  }

  return false
}

// Updated signalHandlers to map signal to a map of identifier-handler pairs
const signalHandlers = {}

// Register a signal-specific handler with centralized listener
const registerSignalHandler = (
  signal,
  handler,
  shouldTerminate = true,
  identifier = generateRandomIdentifier(),
) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Handler must be a function')
  }

  const isAsync = handler.constructor.name === 'AsyncFunction'
  if (!isAsync) {
    throw new TypeError(
      'Handler must be an asynchronous function (returning a Promise)',
    )
  }

  // Enforce global uniqueness of handler identifiers
  if (globalHandlerIdentifiers.has(identifier)) {
    throw new Error(
      `Handler with identifier '${identifier}' already exists globally`,
    )
  }

  // Initialize handler map for the signal if not present
  if (!signalHandlers[signal]) {
    signalHandlers[signal] = new Map()

    // Attach a single listener for the signal
    process.on(signal, async () => {
      if (isShuttingDown) return

      isShuttingDown = true
      logger(`Shutting down on ${signal}`)

      const shutdownTimer = setTimeout(() => {
        console.warn('Shutdown process timed out. Forcing exit.')
        process.exit(customExitCode || DEFAULT_EXIT_CODE)
      }, shutdownTimeout)

      // Execute all handlers associated with the signal
      for (const [
        id,
        { handler: sigHandler, shouldTerminate: term },
      ] of signalHandlers[signal]) {
        try {
          await sigHandler(signal)
        } catch (error) {
          console.error(
            `Error in handler '${id}' for signal '${signal}': ${error}`,
          )
          if (errorHandlingStrategy === 'stop') {
            console.error('Stopping shutdown process due to error in handler.')
            clearTimeout(shutdownTimer)
            process.exit(customExitCode || DEFAULT_EXIT_CODE)
          }
        }

        if (term) {
          await shutdown(signal)
          break // Proceed to shutdown if shouldTerminate is true
        }
      }

      clearTimeout(shutdownTimer)
      logger('Shutdown completed')
      const exitCode = customExitCode || getExitCode(signal)
      logger(`Shutdown exitCode: ${exitCode}`)
      process.exit(exitCode)
    })
  }

  // Register the handler with its unique identifier
  signalHandlers[signal].set(identifier, { handler, shouldTerminate })
  globalHandlerIdentifiers.add(identifier)
  logger(
    `Signal handler registered for '${signal}', identifier: '${identifier}'`,
  )

  // Return the identifier for reference
  return identifier
}

// Remove a signal-specific handler
const removeSignalHandler = (signal, identifier) => {
  const handlersMap = signalHandlers[signal]
  if (handlersMap?.has(identifier)) {
    handlersMap.delete(identifier)
    globalHandlerIdentifiers.delete(identifier)
    logger(`Removed signal handler '${identifier}' for signal '${signal}'`)

    // If no handlers remain, remove the listener
    if (handlersMap.size === 0) {
      process.removeAllListeners(signal)
      delete signalHandlers[signal]
      logger(`Removed all handlers and listener for signal '${signal}'`)
    }
    return true
  }

  return false
}

// Sets the global error handling strategy
const setErrorHandlingStrategy = (strategy) => {
  if (!['continue', 'stop'].includes(strategy)) {
    throw new Error("handling strategy must be either 'continue' or 'stop'")
  }

  errorHandlingStrategy = strategy
}

// List all registered handlers both generic and signal-specific
const listHandlers = () => ({ ...handlers, ...signalHandlers })

const signals = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'exit'])

const addSignal = (signal) => {
  if (signals.has(signal)) {
    logger(`Signal already added: ${signal}`)
    return false
  }

  signals.add(signal)
  attachListener(signal)
  logger(`Added signal: ${signal}`)
  return true
}

const removeSignal = (signal) => {
  if (signals.delete(signal)) {
    process.removeListener(signal, shutdown)
    logger(`Removed signal: ${signal}`)
    return true
  }

  return false
}

const listSignals = () => [...signals]

const DEFAULT_EXIT_CODE = 1

const getExitCode = (signal) => {
  let code
  if (typeof signal === 'number') {
    code = signal
  } else if (signal instanceof Error) {
    code = signal.errno
  } else {
    code = os.constants.signals[signal]
  }

  return code ?? DEFAULT_EXIT_CODE
}

let isShuttingDown = false
let shutdownTimeout = 30_000 // 30 seconds timeout for the shutdown process

// Function to set the shutdown timeout
const setShutdownTimeout = (timeout) => {
  if (typeof timeout !== 'number' || timeout < 0) {
    throw new Error('Shutdown timeout must be a positive number')
  }

  logger(`Shutdown timeout set to: ${timeout}`)
  shutdownTimeout = timeout
}

let customExitCode // Variable to store custom exit code

// Function to set a custom exit code
const setCustomExitCode = (code) => {
  if (typeof code !== 'number') {
    throw new TypeError('Custom exit code must be a number')
  }

  logger(`Custom exit code set to: ${code}`)
  customExitCode = code
}

const shutdown = async (signal) => {
  if (isShuttingDown) {
    logger('Shutdown already in progress')
    return
  }

  isShuttingDown = true
  logger(`Shutting down on ${signal}`)

  const shutdownTimer = setTimeout(() => {
    console.warn('Shutdown process timed out. Forcing exit.')

    // eslint-disable-next-line unicorn/no-process-exit
    process.exit(customExitCode || 1) // Use custom exit code if timeout occurs
  }, shutdownTimeout)

  const sortedPhases = Object.keys(handlers)
    .map(Number)
    .sort((a, b) => a - b)

  for (const phase of sortedPhases) {
    for (const identifier of Object.keys(handlers[phase])) {
      try {
        await handlers[phase][identifier](signal)
      } catch (error) {
        console.error(
          `Error in shutdown handler '${identifier}' for phase '${phase}': ${error}`,
        )
        if (errorHandlingStrategy === 'stop') {
          console.error('Stopping shutdown process due to error in handler.')
          clearTimeout(shutdownTimer)

          // eslint-disable-next-line unicorn/no-process-exit
          process.exit(customExitCode || 1) // Use custom exit code if error occurs
        }
      }
    }
  }

  clearTimeout(shutdownTimer)
  logger('Shutdown completed')
  const exitCode = customExitCode || getExitCode(signal)
  logger(`Shutdown exitCode: ${exitCode}`)

  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(exitCode)
}

const attachListener = (signal) => process.on(signal, shutdown)
for (const signal of signals) {
  attachListener(signal)
}

export {
  addSignal,
  listHandlers,
  listSignals,
  registerHandler,
  registerSignalHandler,
  removeHandler,
  removeSignal,
  removeSignalHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
}
