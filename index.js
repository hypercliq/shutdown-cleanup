import * as os from 'node:os'
import process from 'node:process'

// Debugging setup
const { DEBUG } = process.env
const enabled = DEBUG && /shutdown-cleanup|^\*$/.test(DEBUG)
const logger = (...message) => {
  if (enabled) {
    console.debug('\u{1F41E}shutdown-cleanup', ...message)
  }
}

const signals = new Set(['SIGTERM', 'SIGHUP', 'SIGINT', 'beforeExit'])
const uncatchableSignals = new Set(['SIGKILL', 'SIGSTOP'])
const removedSignals = new Set()

const state = {
  isShuttingDown: false,
  shutdownTimeout: 30_000, // Default timeout of 30 seconds
  customExitCode: undefined,
  errorHandlingStrategy: 'continue', // Default strategy is to continue on error
}

// Sets the global error handling strategy
const setErrorHandlingStrategy = (strategy) => {
  if (!['continue', 'stop'].includes(strategy)) {
    throw new Error("handling strategy must be either 'continue' or 'stop'")
  }

  state.errorHandlingStrategy = strategy
}

const registeredHandlers = new Map()

const hasHandlerIdentifier = (identifier) =>
  registeredHandlers
    .values()
    .some((phaseHandlers) => phaseHandlers.has(identifier))

const registerPhaseHandler = (phaseKey, phaseHandlers, identifier, handler) => {
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
  const isTerminate = shouldTerminate !== false // Default to true if undefined

  // Define the listener for the signal
  const listener = async (signal) => {
    const customHandler = phaseHandlers.get(identifier)

    if (!customHandler) {
      console.warn(`No handler found for signal: ${signal}`)
      return
    }

    const runHandler = async () => {
      logger(`Handling signal: ${signal}`)
      try {
        await customHandler.handler(signal)
      } catch (error) {
        console.error(`Error in handler '${identifier}': ${error}`)
        if (state.errorHandlingStrategy === 'stop') {
          console.error('Stopping shutdown process due to error in handler.')
          process.exit(state.customExitCode ?? 1) //eslint-disable-line unicorn/no-process-exit
        }
      }
    }

    if (customHandler.shouldTerminate) {
      return runShutdown(signal, runHandler)
    }

    await runHandler()
  }

  // Attach first so a listener attachment error cannot change the registry
  // or remove the existing shutdown listener.
  process.on(signal, listener)

  if (signals.has(signal)) {
    signals.delete(signal)
    removedSignals.add(signal)
    process.off(signal, shutdown)
    logger(
      `Signal ${signal} removed from main listener due to specific handler`,
    )
  }

  phaseHandlers.set(identifier, {
    type: 'signal',
    signal,
    handler,
    shouldTerminate: isTerminate,
    listener,
  })

  logger(`Signal handler registered for signal: ${signal}`)
}

const createUniqueIdentifier = (() => {
  let generatedHandlerId = Date.now() // Start with a timestamp to reduce collision risk

  return () => {
    let identifier
    do {
      identifier = `handler_${generatedHandlerId++}`
    } while (hasHandlerIdentifier(identifier))

    return identifier
  }
})()

// Registers a handler either for a specific signal or a phase
const registerHandler = (handler, options = {}) => {
  if (typeof handler !== 'function') {
    throw new TypeError('Handler must be a function')
  }

  if (
    options === null ||
    typeof options !== 'object' ||
    Array.isArray(options)
  ) {
    throw new TypeError('Options must be a non-null object, not an array')
  }

  const {
    identifier: providedIdentifier,
    phase,
    signal,
    shouldTerminate,
  } = options

  if (
    providedIdentifier !== undefined &&
    typeof providedIdentifier !== 'string'
  ) {
    throw new TypeError('Identifier must be a string')
  }

  if (signal !== undefined && typeof signal !== 'string') {
    throw new TypeError('Signal must be a string')
  }

  if (shouldTerminate !== undefined && typeof shouldTerminate !== 'boolean') {
    throw new TypeError('"shouldTerminate" must be a boolean')
  }

  if (
    providedIdentifier !== undefined &&
    hasHandlerIdentifier(providedIdentifier)
  ) {
    throw new Error(
      `Handler with identifier '${providedIdentifier}' already exists`,
    )
  }

  const isSignalHandler = signal !== undefined
  if (isSignalHandler && phase !== undefined) {
    throw new Error('Cannot specify both "signal" and "phase"')
  }

  const selectedPhase = phase === undefined ? 1 : phase
  const phaseKey = isSignalHandler ? 0 : selectedPhase
  if (isSignalHandler) {
    if (uncatchableSignals.has(signal)) {
      throw new Error(`Cannot handle uncatchable signal '${signal}'`)
    }
  } else {
    if (shouldTerminate !== undefined) {
      throw new Error('"shouldTerminate" requires "signal"')
    }
    if (!Number.isSafeInteger(phaseKey) || phaseKey < 1) {
      throw new Error('Phase must be a positive integer greater than 0')
    }
  }

  const existingPhaseHandlers = registeredHandlers.get(phaseKey)
  if (
    isSignalHandler &&
    existingPhaseHandlers?.values().some((entry) => entry.signal === signal)
  ) {
    throw new Error(`Signal ${signal} already has a handler`)
  }

  // All input validation precedes identifier generation and state changes.
  const identifier = providedIdentifier ?? createUniqueIdentifier()
  const phaseHandlers = existingPhaseHandlers ?? new Map()

  if (isSignalHandler) {
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

  if (!existingPhaseHandlers) {
    registeredHandlers.set(phaseKey, phaseHandlers)
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

  const sortedPhases = registeredHandlers
    .keys()
    .toArray()
    .toSorted((a, b) => a - b)

  for (const phase of sortedPhases) {
    const phaseHandlers = registeredHandlers.get(phase)
    const phaseKey = phase === 0 ? 'signal' : phase
    const phaseEntry = {
      phaseKey,
      handlers: [],
    }

    for (const [identifier, { listener, ...handlerData }] of phaseHandlers) {
      phaseEntry.handlers.push({
        identifier,
        ...handlerData,
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

const getExitCode = (value) => {
  let code
  if (Number.isSafeInteger(value)) {
    code = value
  } else if (value instanceof Error) {
    code = value.errno
  } else {
    code = os.constants.signals[value]
  }

  return code ?? DEFAULT_EXIT_CODE
}

// Function to set the shutdown timeout
const setShutdownTimeout = (timeout) => {
  if (
    typeof timeout !== 'number' ||
    !Number.isFinite(timeout) ||
    timeout <= 0
  ) {
    throw new Error('Shutdown timeout must be a positive number')
  }

  logger(`Shutdown timeout set to: ${timeout}`)
  state.shutdownTimeout = timeout
}

// Function to set a custom exit code
const setCustomExitCode = (code) => {
  if (typeof code !== 'number' || !Number.isSafeInteger(code)) {
    throw new TypeError('Custom exit code must be a number and a safe integer')
  }

  logger(`Custom exit code set to: ${code}`)
  state.customExitCode = code
}

// Claim shutdown and start one deadline before invoking any terminating handler.
const runShutdown = async (signal, runSignalHandler) => {
  if (state.isShuttingDown) {
    logger('Shutdown already in progress')
    return
  }

  state.isShuttingDown = true
  logger(`Shutting down on ${signal}`)

  // Freeze the work list before any cleanup, including the signal handler.
  const shutdownPhases = registeredHandlers
    .keys()
    .filter((phase) => phase !== 0)
    .toArray()
    .toSorted((a, b) => a - b)
    .map((phase) => [phase, [...registeredHandlers.get(phase)]])

  const shutdownTimer = setTimeout(() => {
    console.warn('Shutdown process timed out. Forcing exit.')
    process.exit(state.customExitCode ?? 1) // eslint-disable-line unicorn/no-process-exit
  }, state.shutdownTimeout)

  if (runSignalHandler) {
    await runSignalHandler()
  }

  for (const [phase, phaseHandlers] of shutdownPhases) {
    for (const [identifier, handlerEntry] of phaseHandlers) {
      // Honor removals; reusing an identifier creates a different registration.
      if (registeredHandlers.get(phase)?.get(identifier) === handlerEntry) {
        try {
          await handlerEntry.handler(signal)
        } catch (error) {
          console.error(
            `Error in shutdown handler '${identifier}' for phase '${phase}': ${error}`,
          )
          if (state.errorHandlingStrategy === 'stop') {
            console.error('Stopping shutdown process due to error in handler.')
            clearTimeout(shutdownTimer)
            process.exit(state.customExitCode ?? 1) //eslint-disable-line unicorn/no-process-exit
          }
        }
      }
    }
  }

  clearTimeout(shutdownTimer)
  logger('Shutdown completed')
  const exitCode = state.customExitCode ?? getExitCode(signal)
  logger(`Shutdown exitCode: ${exitCode}`)
  process.exit(exitCode) //eslint-disable-line unicorn/no-process-exit
}

// Only forward the first event argument; other arguments are not cleanup hooks.
const shutdown = (signal) => runShutdown(signal)

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
