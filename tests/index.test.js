const { fork } = require('child_process')
const path = require('path')
const signals = require('os').constants.signals

const programFile = path.resolve(__dirname, './program.js')

const forkProcess = args => {
  return new Promise(resolve => {
    const proc = fork(programFile, args, { silent: true })

    let output = ''

    proc.stdout.on('data', data => {
      output += data.toString()
    })

    proc.stderr.on('data', data => {
      output += data.toString()
    })

    proc.on('exit', code => {
      resolve([code, output])
    })
  })
}

test('SIGINT', async () => {
  const args = ['-k', 'SIGINT']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(signals.SIGINT)
  expect(output).toMatch(/^SIGINT/)
})

test('SIGTERM', async () => {
  const args = ['-k', 'SIGTERM']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(signals.SIGTERM)
  expect(output).toMatch(/^SIGTERM/)
})

test('SIGHUP', async () => {
  const args = ['-k', 'SIGHUP']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(signals.SIGHUP)
  expect(output).toMatch(/^SIGHUP/)
})

test('SIGABRT', async () => {
  const args = ['-a', 'SIGABRT', '-k', 'SIGABRT']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(signals.SIGABRT)
  expect(output).toMatch(/^SIGABRT/)
})

test('exit', async () => {
  const args = ['-e', '42']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(42)
  expect(output).toMatch(/^42/)
})

test('Remove exit', async () => {
  const args = ['-e', '42', '-r', 'exit']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(42)
  expect(output).toMatch('')
})

test('uncaughtException not added', async () => {
  const args = ['--uncaught-exception']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(1)
  expect(output).toMatch('foo()')
})

test('uncaughtException added', async () => {
  const args = ['--uncaught-exception', '-a', 'uncaughtException']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(1)
  expect(output).toMatch(/^ReferenceError: foo is not defined/)
})

test('unhandledRejection not added', async () => {
  const args = ['--unhandled-rejection']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(1)
  expect(output).toMatch('UnhandledPromiseRejectionWarning')
})

test('unhandledRejection added', async () => {
  const args = ['--unhandled-rejection', '-a', 'unhandledRejection']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(1)
  expect(output).toMatch(/^ReferenceError: foo is not defined/)
})
