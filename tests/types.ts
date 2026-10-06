import {
  listHandlers,
  listSignals,
  registerHandler,
  setErrorHandlingStrategy,
  type Handler,
} from '@hypercliq/shutdown-cleanup'

const handler: Handler = async (signal) => {
  console.log(signal)
}

const generatedIdentifier: string = registerHandler(handler)
const phaseIdentifier: string = registerHandler(handler, {
  identifier: 'phase-handler',
  phase: 2,
})
const signalIdentifier: string = registerHandler(handler, {
  identifier: 'signal-handler',
  signal: 'SIGUSR2',
  shouldTerminate: false,
})

console.log(generatedIdentifier, phaseIdentifier, signalIdentifier)

// @ts-expect-error phase and signal cannot be used together.
registerHandler(handler, { phase: 1, signal: 'SIGTERM' })

// @ts-expect-error shouldTerminate only applies to signal-specific handlers.
registerHandler(handler, { shouldTerminate: false })

// @ts-expect-error identifiers must be strings.
registerHandler(handler, { identifier: 42 })

// @ts-expect-error null does not request the default phase.
registerHandler(handler, { phase: null })

// @ts-expect-error signals must be strings.
registerHandler(handler, { signal: false })

// @ts-expect-error termination flags must be booleans.
registerHandler(handler, { signal: 'SIGTERM', shouldTerminate: 0 })

// @ts-expect-error options must be an object.
registerHandler(handler, 42)

// @ts-expect-error null options are invalid.
registerHandler(handler, null)

// @ts-expect-error an array is not a registration options object.
registerHandler(handler, [])

// @ts-expect-error a handler must be a function.
registerHandler('handler')

const emptyIdentifier: string = registerHandler(handler, { identifier: '' })
const emptyEventIdentifier: string = registerHandler(handler, {
  signal: '',
  shouldTerminate: false,
})
console.log(emptyIdentifier, emptyEventIdentifier)

setErrorHandlingStrategy('continue')
setErrorHandlingStrategy('stop')

// @ts-expect-error invalid error handling strategy.
setErrorHandlingStrategy('ignore')

const signals: string[] = listSignals({ includeSignalHandlers: true })
console.log(signals)

for (const phase of listHandlers()) {
  for (const entry of phase.handlers) {
    if (entry.type === 'signal') {
      const signal: string = entry.signal
      const shouldTerminate: boolean = entry.shouldTerminate
      console.log(signal, shouldTerminate)
    } else {
      // @ts-expect-error phase handlers do not expose signal metadata.
      console.log(entry.signal)
    }
  }
}
