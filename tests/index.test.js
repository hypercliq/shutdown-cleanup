const { fork } = require('child_process')
const path = require('path')
const os = require('os')

const programFile = path.resolve(__dirname, './program.js')

const forkProcess = (args) => {
  return new Promise((resolve) => {
    const proc = fork(programFile, args, { silent: true })

    let output = ''

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      output += data.toString()
    })

    proc.on('exit', (code) => {
      resolve([code, output])
    })
  })
}

/**
 * process.kill on win32 is dodgy at best.
 */
describe('not windows machines', () => {
  if (os.platform() === 'win32') return
  test('SIGINT', async () => {
    const args = ['-k', 'SIGINT']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(os.constants.signals.SIGINT)
    expect(output).toMatch(/^SIGINT/)
  })

  test('SIGTERM', async () => {
    const args = ['-k', 'SIGTERM']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(os.constants.signals.SIGTERM)
    expect(output).toMatch(/^SIGTERM/)
  })

  test('SIGHUP', async () => {
    const args = ['-k', 'SIGHUP']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(os.constants.signals.SIGHUP)
    expect(output).toMatch(/^SIGHUP/)
  })

  test('SIGABRT', async () => {
    const args = ['-a', 'SIGABRT', '-k', 'SIGABRT']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(os.constants.signals.SIGABRT)
    expect(output).toMatch(/^SIGABRT/)
  })
})

test('exit', async () => {
  const args = ['-e', '42']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(42)
  expect(output).toMatch(/^42/)
})

test('quit', async () => {
  const args = ['-q']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(0)
  expect(output).toMatch(/^0/)
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

  const nodejs_version = parseInt(
    process.versions.node.split('.')[0].trim(),
    10
  )
  // node v15 and above exits with a non-zero code for this
  const exit_code = nodejs_version <= 14 ? 0 : 1
  expect(code).toBe(exit_code)
  const error_msg =
    nodejs_version <= 14 ? 'UnhandledPromiseRejectionWarning' : 'Error: boom'
  expect(output).toMatch(error_msg)
})

test('unhandledRejection added', async () => {
  const args = ['--unhandled-rejection', '-a', 'unhandledRejection']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(1)
  expect(output).toMatch(/^Error: boom/)
})

test('debug for shutdown-cleanup', async () => {
  const args = ['--debug', 'shutdown-cleanup']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(0)
  expect(output).toMatch(/^🐞shutdown-cleanup/)
})

test('debug for *', async () => {
  const args = ['--debug', '*']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(0)
  expect(output).toMatch(/^🐞shutdown-cleanup/)
})

test('debug for some other module', async () => {
  const args = ['--debug', 'some-module']

  const [code, output] = await forkProcess(args)

  expect(code).toBe(0)
  expect(output).not.toMatch(/^🐞shutdown-cleanup/)
})

test('no debug', async () => {
  const args = []

  const [code, output] = await forkProcess(args)

  expect(code).toBe(0)
  expect(output).not.toMatch(/^🐞shutdown-cleanup/)
})
