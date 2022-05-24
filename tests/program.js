const program = require('commander')
const shutdownCleanup = require('../dist/index')

program
  .option('-k, --kill-signal <signal>')
  .option('-a, --add-signal <signal>')
  .option('-r, --remove-signal <signal>')
  .option('-e, --exit <code>')
  .option('-q, --quit')
  .option('-x, --uncaught-exception')
  .option('-y, --unhandled-rejection')
  .option('-f, --faulty-handler <problem>')

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

const unhandledRejection = () => {
  const p = Promise.reject(new Error('unhandled rejection'))

  const badCall = async () => {
    await p
  }

  badCall()
}

shutdownCleanup.registerHandler(console.log)

if (opts.faultyHandler) {
  switch (opts.faultyHandler) {
    case 'uncaughtException':
      shutdownCleanup.registerHandler(() => {
        x.boom
      })
      break
    case 'unhandledRejection':
      shutdownCleanup.registerHandler(() => {
        unhandledRejection()
      })

      break
    case 'throw':
      shutdownCleanup.registerHandler(() => {
        throw new Error('faulty handler')
      })
      break
    default:
      throw new Error(`Unknown faulty handler: ${opts.faultyHandler}`)
  }
}

if (opts.addSignal) shutdownCleanup.addSignal(opts.addSignal)

if (opts.removeSignal) shutdownCleanup.removeSignal(opts.removeSignal)

lookBusy()

if (opts.uncaughtException) {
  foo()
}

if (opts.unhandledRejection) {
  unhandledRejection()
}

if (opts.killSignal) {
  process.kill(process.pid, opts.killSignal)
}

if (opts.exit) process.exitCode = opts.exit

if (opts.quit) {
  // when exiting normally do nothing
}
