import { appendFileSync } from 'node:fs'
import process from 'node:process'
import { setTimeout as delay } from 'node:timers/promises'
import {
  addSignal,
  registerHandler,
  removeHandler,
  setCustomExitCode,
  setShutdownTimeout,
} from '@hypercliq/shutdown-cleanup'

const [signal, mode, journal] = process.argv.slice(2)
const record = (value) => appendFileSync(journal, `${value}\n`)
setShutdownTimeout(mode === 'timeout' ? 100 : 2000)
if (mode === 'custom-exit') setCustomExitCode(42)

if (mode === 'added') addSignal(signal)
else if (
  ['specific', 'restored', 'repeat', 'timeout', 'interrupted'].includes(mode)
) {
  const identifier = registerHandler(
    async (value) => {
      record(`signal-start:${value}`)
      if (mode === 'timeout') return new Promise(() => {})
      if (mode === 'interrupted') await delay(5000)
      await delay(40)
      record(`signal-end:${value}`)
    },
    { signal, shouldTerminate: mode !== 'repeat' },
  )
  if (mode === 'restored') removeHandler(identifier)
}
registerHandler(async (value) => {
  record(`phase-1-start:${value}`)
  await delay(40)
  record(`phase-1-end:${value}`)
})
registerHandler((value) => record(`phase-2:${value}`), { phase: 2 })

// No event emissions: only the parent OS/native harness triggers shutdown.
setInterval(() => {}, 1000)
record('ready')
process.send?.('ready')
if (mode === 'explicit-exit') process.exit(23) // eslint-disable-line unicorn/no-process-exit
