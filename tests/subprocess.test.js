import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { EventEmitter, once } from 'node:events'
import process from 'node:process'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'
import { runSubprocess } from './subprocess-helper.js'

describe('Subprocess test helper', () => {
  for (const stream of ['stdout', 'stderr']) {
    it(`rejects missing expected ${stream} even when the exit code matches`, async () => {
      await assert.rejects(
        runSubprocess({
          arguments_: ['--eval', ''],
          [`${stream}Expectation`]: (output) =>
            assert.match(output.toString(), /required output/),
        }),
        { code: 'ERR_ASSERTION' },
      )
    })

    it(`rejects unexpected ${stream}`, async () => {
      await assert.rejects(
        runSubprocess({
          arguments_: ['--eval', `process.${stream}.write('unexpected')`],
        }),
        { code: 'ERR_ASSERTION' },
      )
    })
  }

  it('collects split stdout and stderr, including split UTF-8 characters', async () => {
    const expected = '{"message":"split 🌍 output"}\n'
    let stdoutCalls = 0
    let stderrCalls = 0
    await runSubprocess({
      arguments_: [
        '--eval',
        `
          const output = Buffer.from(${JSON.stringify(expected)})
          const split = output.indexOf(Buffer.from('🌍')) + 2
          process.stdout.write(output.subarray(0, split))
          process.stderr.write(output.subarray(0, split))
          setTimeout(() => {
            process.stdout.write(output.subarray(split))
            process.stderr.write(output.subarray(split))
          }, 50)
        `,
      ],
      stdoutExpectation: (output) => {
        stdoutCalls++
        assert.strictEqual(output.toString(), expected)
        assert.deepStrictEqual(JSON.parse(output.toString()), {
          message: 'split 🌍 output',
        })
      },
      stderrExpectation: (output) => {
        stderrCalls++
        assert.strictEqual(output.toString(), expected)
      },
    })
    assert.strictEqual(stdoutCalls, 1)
    assert.strictEqual(stderrCalls, 1)
  })

  it('waits for close and includes output received after exit', async () => {
    const child = new EventEmitter() // eslint-disable-line unicorn/prefer-event-target -- Model ChildProcess events.
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let hasAsserted = false
    const result = runSubprocess(
      {
        arguments_: [],
        stdoutExpectation: (output) => {
          hasAsserted = true
          assert.strictEqual(output.toString(), 'before exit\nafter exit\n')
        },
        stderrExpectation: (output) =>
          assert.strictEqual(output.toString(), 'after exit error\n'),
      },
      () => child,
    )
    const streamsClosed = Promise.all([
      once(child.stdout, 'close'),
      once(child.stderr, 'close'),
    ])
    child.stdout.write('before exit\n')
    child.emit('exit', 0, null) // eslint-disable-line unicorn/no-null
    await Promise.resolve()
    assert.strictEqual(hasAsserted, false)
    child.stdout.end('after exit\n')
    child.stderr.end('after exit error\n')
    await streamsClosed
    child.emit('close', 0, null) // eslint-disable-line unicorn/no-null
    await result
    assert.strictEqual(hasAsserted, true)
  })

  it('uses the current Node executable', async () => {
    await runSubprocess(
      { arguments_: ['--eval', ''] },
      (executable, ...rest) => {
        assert.strictEqual(executable, process.execPath)
        return spawn(executable, ...rest)
      },
    )
  })

  it('requires a readiness message when native delivery is requested', async () => {
    await assert.rejects(
      runSubprocess({ arguments_: ['--eval', ''], onReady: () => {} }),
      /Subprocess never became ready/,
    )
  })

  it('rejects a failed asynchronous native action even after the child exits', async () => {
    const failure = new Error('native trigger failed')
    await assert.rejects(
      runSubprocess({
        arguments_: ['--eval', "process.send('ready'); process.disconnect()"],
        onReady: async () => {
          await new Promise((resolve) => setTimeout(resolve, 50))
          throw failure
        },
      }),
      (error) => error === failure,
    )
  })

  it('rejects synchronous spawn failures', async () => {
    const error = new Error('synchronous spawn failure')
    await assert.rejects(
      runSubprocess({ arguments_: [] }, () => {
        throw error
      }),
      (received) => received === error,
    )
  })

  it('rejects asynchronous spawn failures', async () => {
    await assert.rejects(
      runSubprocess({ arguments_: [] }, (executable, arguments_) =>
        spawn(executable, arguments_, {
          cwd: new URL('nonexistent-directory/', import.meta.url),
        }),
      ),
      (error) => {
        assert.match(error.message, /spawn\/process failure/)
        assert.strictEqual(error.cause.code, 'ENOENT')
        return true
      },
    )
  })

  for (const stream of ['stdout', 'stderr']) {
    it(
      `rejects ${stream} failures and terminates the child`,
      { timeout: 5000 },
      async (t) => {
        const cause = new Error(`${stream} read failure`)
        let child
        let closed
        t.after(() => child?.kill('SIGKILL'))
        await assert.rejects(
          runSubprocess(
            { arguments_: ['--eval', 'setInterval(() => {}, 1000)'] },
            (...arguments_) => {
              child = spawn(...arguments_)
              closed = once(child, 'close')
              child.once('spawn', () => child[stream].destroy(cause))
              return child
            },
          ),
          (error) => {
            assert.strictEqual(
              error.message,
              `Subprocess ${stream} stream failure`,
            )
            assert.strictEqual(error.cause, cause)
            return true
          },
        )
        const [, signal] = await closed
        assert.strictEqual(signal, 'SIGKILL')
      },
    )
  }

  it('reports captured output at the watchdog deadline', async (t) => {
    t.mock.timers.enable({ apis: ['setTimeout'] })
    const child = new EventEmitter() // eslint-disable-line unicorn/prefer-event-target -- Model ChildProcess events.
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.kill = t.mock.fn(() => true)
    const result = assert.rejects(
      runSubprocess({ arguments_: [], timeoutMs: 1000 }, () => child),
      (error) => {
        assert.match(error.message, /timed out after 1000ms/)
        assert.match(error.message, /stdout: partial stdout/)
        assert.match(error.message, /stderr: partial stderr/)
        return true
      },
    )
    child.stdout.write('partial stdout')
    child.stderr.write('partial stderr')
    t.mock.timers.tick(999)
    assert.strictEqual(child.kill.mock.callCount(), 0)
    t.mock.timers.tick(1)
    await result
    assert.deepStrictEqual(child.kill.mock.calls[0].arguments, ['SIGKILL'])
    assert.strictEqual(child.stdout.destroyed, true)
    assert.strictEqual(child.stderr.destroyed, true)
  })

  it(
    'kills a ready stuck child when the watchdog expires',
    { timeout: 5000 },
    async (t) => {
      t.mock.timers.enable({ apis: ['setTimeout'] })
      let child
      let closed
      t.after(() => child?.kill('SIGKILL'))
      await assert.rejects(
        runSubprocess(
          {
            arguments_: [
              '--eval',
              `
              process.on('SIGTERM', () => {})
              setInterval(() => {}, 1000)
              process.send('ready')
            `,
            ],
            timeoutMs: 1000,
            // Exercise real termination only after the child has installed its
            // signal handler; startup speed must not decide this test's result.
            onReady: () => t.mock.timers.tick(1000),
          },
          (...arguments_) => {
            child = spawn(...arguments_)
            closed = once(child, 'close')
            return child
          },
        ),
        /timed out after 1000ms/,
      )
      const [, signal] = await closed
      assert.strictEqual(signal, 'SIGKILL')
    },
  )
})
