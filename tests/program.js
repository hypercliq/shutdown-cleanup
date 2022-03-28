const program = require('commander')
const { ShutdownCleanup } = require('../dist/index')

program
  .option('-k, --kill-signal <signal>')
  .option('-a, --add-signal <signal>')
  .option('-r, --remove-signal <signal>')
  .option('-e, --exit <code>')
  .option('-q, --quit')
  .option('-x, --uncaught-exception')
  .option('-y, --unhandled-rejection')

program.parse(process.argv)

const opts = program.opts()

const lookBusy = () => {
  let current = 0
  const timerId = setInterval(() => {
    if (current === 3) {
      clearInterval(timerId)
    }
    current++
  }, 100)
}

ShutdownCleanup.registerHandler(console.log)

if (opts.addSignal) ShutdownCleanup.addSignal(opts.addSignal)

if (opts.removeSignal) ShutdownCleanup.removeSignal(opts.removeSignal)

lookBusy()

if (opts.uncaughtException) {
  foo()
}

if (opts.unhandledRejection) {
  const p = new Promise((_, reject) => {
    reject(new Error('boom'))
  })

  const badCall = async () => {
    await p
  }

  badCall()
}

if (opts.killSignal) {
  process.kill(process.pid, opts.killSignal)
}

if (opts.exit) process.exitCode = opts.exit

if (opts.quit) {
  // when exiting normally do nothing
}
