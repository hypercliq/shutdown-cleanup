const program = require('commander')
const { ShutdownCleanup } = require('../lib/index')

program
  .option('-k, --kill-signal <signal>')
  .option('-a, --add-signal <signal>')
  .option('-r, --remove-signal <signal>')
  .option('-e, --exit <code>')
  .option('-q, --quit')
  .option('-x, --uncaught-exception')
  .option('-y, --unhandled-rejection')

program.parse(process.argv)

function lookBusy() {
  let current = 0
  const timerId = setInterval(() => {
    if (current === 3) {
      clearInterval(timerId)
    }
    current++
  }, 100)
}

if (program.addSignal) ShutdownCleanup.addSignal(program.addSignal)

if (program.removeSignal) ShutdownCleanup.removeSignal(program.removeSignal)

ShutdownCleanup.registerHandler(console.log)

lookBusy()

if (program.uncaughtException) {
  foo()
}

if (program.unhandledRejection) {
  const p = new Promise((resolve, reject) => {
    if (false) resolve('never called :(')
    else reject(new Error('boom'))
  })

  const badCall = async () => {
    await p
  }

  badCall()
}

if (program.killSignal) process.kill(process.pid, program.killSignal)

if (program.exit) process.exitCode = program.exit

if (program.quit) {
  // when exiting normally do nothing
}
