const { fork } = require('child_process')
const path = require('path')
const os = require('os')

const programFile = path.resolve(__dirname, './program.js')

const showOutput = !!process.env.SHOW_OUTPUT

const forkProcess = (args, debug) => {
  return new Promise((resolve) => {
    const proc = fork(programFile, args, {
      silent: true,
      env: { DEBUG: debug },
    })

    let output = ''

    proc.stdout.on('data', (data) => {
      output += data.toString()
    })

    proc.stderr.on('data', (data) => {
      output += data.toString()
    })

    proc.on('exit', (code) => {
      if (showOutput) console.log('code', code, 'output', output)

      resolve([code, output])
    })
  })
}

describe('Core functionalities', () => {
  /**
   * process.kill on win32 is dodgy at best.
   */
  describe('not windows machines', () => {
    if (os.platform() === 'win32') return
    test('SIGINT', async () => {
      const args = ['-k', 'SIGINT']

      const [code, output] = await forkProcess(args)

      expect(code).toBe(os.constants.signals.SIGINT)
      expect(output).toMatchSnapshot()
    })

    test('SIGTERM', async () => {
      const args = ['-k', 'SIGTERM']

      const [code, output] = await forkProcess(args)

      expect(code).toBe(os.constants.signals.SIGTERM)
      expect(output).toMatchSnapshot()
    })

    test('SIGHUP', async () => {
      const args = ['-k', 'SIGHUP']

      const [code, output] = await forkProcess(args)

      expect(code).toBe(os.constants.signals.SIGHUP)
      expect(output).toMatchSnapshot()
    })

    test('SIGABRT', async () => {
      const args = ['-a', 'SIGABRT', '-k', 'SIGABRT']

      const [code, output] = await forkProcess(args)

      expect(code).toBe(os.constants.signals.SIGABRT)
      expect(output).toMatchSnapshot()
    })
  })

  test('exit on 1', async () => {
    const args = ['-e', '1']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(1)
    expect(output).toMatch('1')
  })

  test('exit on 42', async () => {
    const args = ['-e', '42']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(42)
    expect(output).toMatch('42')
  })

  test('exit on 0x99, no output because this is the special signal', async () => {
    const args = ['-e', '0x99']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0x99)
    expect(output).toMatch('')
  })

  test('quit', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })

  test('Removing exit causes custom process.exit(#) to stop working, of course', async () => {
    const args = ['-e', '42', '-r', 'exit']

    const [code, output] = await forkProcess(args, 'shutdown-cleanup')

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

    expect(code).toBe(0x99)
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
      nodejs_version <= 14
        ? 'UnhandledPromiseRejectionWarning'
        : 'Error: unhandled rejection'
    expect(output).toMatch(error_msg)
  })

  test('unhandledRejection added', async () => {
    const args = ['--unhandled-rejection', '-a', 'unhandledRejection']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0x99)
    expect(output).toMatch(/^Error: unhandled rejection/)
  })
})

describe('Switch on/off debugging', () => {
  test('process.env.DEBUG=shutdown-cleanup', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args, 'shutdown-cleanup')

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })

  test('process.env.DEBUG=*', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args, '*')

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })

  test('process.env.DEBUG=foo-bar shutdown-cleanup', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args, 'foo-bar shutdown-cleanup')

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })

  test('process.env.DEBUG=foo-bar', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args, 'foo-bar')

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })

  test('process.env.DEBUG=', async () => {
    const args = ['-q']

    const [code, output] = await forkProcess(args, '')

    expect(code).toBe(0)
    expect(output).toMatchSnapshot()
  })
})

describe('Faulty handlers', () => {
  test('throw in handler', async () => {
    const args = ['-f', 'throw']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0)
    expect(output).toMatch(/Error in shutdown handler Error: faulty handler/)
  })

  test('uncaughtException in handler', async () => {
    const args = ['-f', 'uncaughtException']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0)
    expect(output).toMatch(
      /Error in shutdown handler ReferenceError: x is not defined/
    )
  })

  test('unhandledRejection in handler', async () => {
    const args = ['-f', 'unhandledRejection']

    const [code, output] = await forkProcess(args)

    expect(code).toBe(0)
    // cannot catch unhandled rekection in handlers... no waiting for async
    expect(output).toMatch('0')
  })
})
