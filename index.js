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

const signals = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'beforeExit'])
const uncatchableSignals = new Set(['SIGKILL', 'SIGSTOP'])
const removedSignals = new Set()

let errorHandlingStrategy = 'continue'

// Sets the global error handling strategy
const setErrorHandlingStrategy = (strategy) => {
  if (!['continue', 'stop'].includes(strategy)) {
    throw new Error("handling strategy must be either 'continue' or 'stop'")
  }

  errorHandlingStrategy = strategy
}

const registeredHandlers = new Map()

const registerPhaseHandler = (phaseKey, phaseHandlers, identifier, handler) => {
  if (Number.isNaN(phaseKey) || phaseKey < 1) {
    throw new Error('Phase must be a positive integer greater than 0')
  }

  phaseHandlers.set(identifier, {
    type: 'phase',
    handler,
  })

  logger(
    `Handler registered for phase '${phaseKey}', identifier: '${identifier}'`,
  )
}

const registerSignalHandler = (
  signal,
  phaseHandlers,
  shouldTerminate,
  identifier,
  handler,
) => {
  if (uncatchableSignals.has(signal)) {
    throw new Error(`Cannot handle uncatchable signal '${signal}'`)
  }

  // Check if signal already has a handler in this phase
  for (const handlerEntry of phaseHandlers.values()) {
    if (handlerEntry.signal === signal) {
      throw new Error(`Signal ${signal} already has a handler`)
    }
  }

  if (signals.has(signal)) {
    signals.delete(signal)
    removedSignals.add(signal)
    process.off(signal, shutdown)
    logger(
      `Signal ${signal} removed from main listener due to specific handler`,
    )
  }

  const terminate = shouldTerminate !== false // Default to true if undefined

  // Define the listener for the signal
  const listener = (signal) => {
    const customHandler = phaseHandlers.get(identifier)

    if (!customHandler) {
      console.warn(`No handler found for signal: ${signal}`)
      return
    }

    logger(`Handling signal: ${signal}`)

    Promise.resolve()
      .then(() => customHandler.handler(signal))
      .then(() => {
        if (customHandler.shouldTerminate) {
          shutdown(signal)
        }
      })
      .catch((error) => {
        console.error(`Error in handler '${identifier}': ${error}`)
        if (errorHandlingStrategy === 'stop') {
          console.error('Stopping shutdown process due to error in handler.')
          process.exit(customExitCode ?? 1) //eslint-disable-line unicorn/no-process-exit
        }
      })
  }

  // Register the handler
  phaseHandlers.set(identifier, {
    type: 'signal',
    signal,
    handler,
    shouldTerminate: terminate,
    listener,
  })

  // Attach the listener
  process.on(signal, listener)
  logger(`Signal handler registered for signal: ${signal}`)
}

// Registers a handler either for a specific signal or a phase
const registerHandler = (handler, options = {}) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Handler must be a function')
  }

  const {
    identifier = `handler_${Math.random().toString(36).slice(2, 11)}`,
    phase,
    signal,
    shouldTerminate,
  } = options

  // Check if identifier already exists
  for (const phaseHandlers of registeredHandlers.values()) {
    if (phaseHandlers.has(identifier)) {
      throw new Error(`Handler with identifier '${identifier}' already exists`)
    }
  }

  if (signal && phase) {
    throw new Error('Cannot specify both "signal" and "phase"')
  }

  const phaseKey = signal ? 0 : Number.parseInt(phase ?? '1', 10)

  let phaseHandlers = registeredHandlers.get(phaseKey)
  if (!phaseHandlers) {
    phaseHandlers = new Map()
    registeredHandlers.set(phaseKey, phaseHandlers)
  }

  if (signal) {
    registerSignalHandler(
      signal,
      phaseHandlers,
      shouldTerminate,
      identifier,
      handler,
    )
  } else {
    registerPhaseHandler(phaseKey, phaseHandlers, identifier, handler)
  }

  return identifier
}

const removeHandler = (identifier) => {
  for (const [phase, phaseHandlers] of registeredHandlers) {
    if (phaseHandlers.has(identifier)) {
      const entry = phaseHandlers.get(identifier)

      if (entry.type === 'signal') {
        process.off(entry.signal, entry.listener)
        logger(`Signal handler removed for signal: ${entry.signal}`)

        if (removedSignals.has(entry.signal)) {
          signals.add(entry.signal)
          attachListener(entry.signal)
          removedSignals.delete(entry.signal)
          logger(`Signal ${entry.signal} re-added to main listener`)
        }
      } else {
        logger(`Handler removed for phase: ${phase}`)
      }

      phaseHandlers.delete(identifier)

      if (phaseHandlers.size === 0) {
        registeredHandlers.delete(phase)
        logger(`Phase ${phase} removed due to no handlers`)
      }

      return true
    }
  }

  return false
}

// List all registered handlers both generic and signal-specific
const listHandlers = () => {
  const handlerList = []

  const sortedPhases = [...registeredHandlers.keys()].sort((a, b) => a - b)

  for (const phase of sortedPhases) {
    const phaseHandlers = registeredHandlers.get(phase)
    const phaseKey = phase === 0 ? 'signal' : phase
    const phaseEntry = {
      phaseKey,
      handlers: [],
    }

    for (const [identifier, handler] of phaseHandlers) {
      phaseEntry.handlers.push({
        identifier,
        ...handler,
      })
    }

    handlerList.push(phaseEntry)
  }

  return handlerList
}

const addSignal = (signal) => {
  if (uncatchableSignals.has(signal)) {
    throw new Error(`Cannot handle uncatchable signal '${signal}'`)
  }
  if (signals.has(signal)) {
    logger(`Signal already added: ${signal}`)
    return false
  }

  const signalHandlers = registeredHandlers.get(0)

  if (signalHandlers) {
    for (const handlerEntry of signalHandlers.values()) {
      if (handlerEntry.signal === signal) {
        logger(`Signal ${signal} already has a handler`)
        return false
      }
    }
  }

  signals.add(signal)
  attachListener(signal)
  logger(`Added signal: ${signal}`)
  return true
}

const removeSignal = (signal) => {
  if (signals.delete(signal)) {
    process.off(signal, shutdown)
    logger(`Removed signal: ${signal}`)
    return true
  }

  return false
}

const listSignals = ({ includeSignalHandlers = false } = {}) => {
  const signalsList = [...signals]
  if (includeSignalHandlers) {
    const signalHandlers = registeredHandlers.get(0)
    if (signalHandlers) {
      for (const handlerEntry of signalHandlers.values()) {
        if (!signalsList.includes(handlerEntry.signal)) {
          signalsList.push(handlerEntry.signal)
        }
      }
    }
  }
  return signalsList
}

const DEFAULT_EXIT_CODE = 1

const getExitCode = (signal) => {
  let code
  if (Number.isInteger(signal)) {
    code = signal
  } else if (signal instanceof Error) {
    code = signal.errno
  } else {
    code = os.constants.signals[signal]
  }

  return code ?? DEFAULT_EXIT_CODE
}

let shutdownTimeout = 30_000 // 30 seconds timeout for the shutdown process

// Function to set the shutdown timeout
const setShutdownTimeout = (timeout) => {
  if (Number.isNaN(timeout) || timeout <= 0) {
    throw new Error('Shutdown timeout must be a positive number')
  }

  logger(`Shutdown timeout set to: ${timeout}`)
  shutdownTimeout = timeout
}

let customExitCode // Variable to store custom exit code

// Function to set a custom exit code
const setCustomExitCode = (code) => {
  if (Number.isNaN(code)) {
    throw new TypeError('Custom exit code must be a number')
  }

  logger(`Custom exit code set to: ${code}`)
  customExitCode = code
}

let isShuttingDown = false

// Main shutdown handler
const shutdown = async (signal) => {
  if (isShuttingDown) {
    logger('Shutdown already in progress')
    return
  }

  isShuttingDown = true
  logger(`Shutting down on ${signal}`)

  const shutdownTimer = setTimeout(() => {
    console.warn('Shutdown process timed out. Forcing exit.')
    process.exit(customExitCode ?? 1) // eslint-disable-line unicorn/no-process-exit
  }, shutdownTimeout)

  const sortedPhases = [...registeredHandlers.keys()]
    .filter((phase) => phase !== 0)
    .sort((a, b) => a - b)

  for (const phase of sortedPhases) {
    const phaseHandlers = registeredHandlers.get(phase)
    for (const [identifier, handlerEntry] of phaseHandlers) {
      await Promise.resolve()
        .then(() => handlerEntry.handler(signal))
        .catch((error) => {
          console.error(
            `Error in shutdown handler '${identifier}' for phase '${phase}': ${error}`,
          )
          if (errorHandlingStrategy === 'stop') {
            console.error('Stopping shutdown process due to error in handler.')
            clearTimeout(shutdownTimer)
            process.exit(customExitCode ?? 1) //eslint-disable-line unicorn/no-process-exit
          }
        })
    }
  }

  clearTimeout(shutdownTimer)
  logger('Shutdown completed')
  const exitCode = customExitCode ?? getExitCode(signal)
  logger(`Shutdown exitCode: ${exitCode}`)
  process.exit(exitCode) //eslint-disable-line unicorn/no-process-exit
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
  removeHandler,
  removeSignal,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
}
