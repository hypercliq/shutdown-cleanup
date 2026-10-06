import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import process from 'node:process'

const expectEmpty = (output) => assert.strictEqual(output.toString(), '')

export const runSubprocess = (
  {
    arguments_,
    stdoutExpectation = expectEmpty,
    stderrExpectation = expectEmpty,
    exitCodeExpectation = 0,
    exitSignalExpectation = null, // eslint-disable-line unicorn/no-null
    onReady,
    timeoutMs = 10_000,
    debug = false,
  },
  spawnChild = spawn,
) =>
  new Promise((resolve, reject) => {
    assert.ok(
      Number.isSafeInteger(timeoutMs) &&
        timeoutMs > 0 &&
        timeoutMs <= 2 ** 31 - 1,
      'Subprocess timeout must be a positive 32-bit integer',
    )

    const child = spawnChild(process.execPath, arguments_, {
      ...(debug && { env: { ...process.env, DEBUG: 'shutdown-cleanup' } }),
      ...(onReady && { stdio: ['ignore', 'pipe', 'pipe', 'ipc'] }),
    })
    const stdoutChunks = []
    const stderrChunks = []
    let isSettled = false
    let readyWork

    const fail = (error) => {
      if (isSettled) return
      isSettled = true
      clearTimeout(watchdog)
      // SIGTERM can be intercepted by the module under test. Force termination
      // and close our pipes so even inherited streams cannot keep the test alive.
      try {
        child.kill('SIGKILL')
      } catch (killError) {
        error = new AggregateError([error, killError], error.message)
      }
      child.stdout.destroy()
      child.stderr.destroy()
      reject(error)
    }

    const watchdog = setTimeout(() => {
      fail(
        new Error(
          `Subprocess timed out after ${timeoutMs}ms: ${JSON.stringify(arguments_)}\n` +
            `stdout: ${Buffer.concat(stdoutChunks).toString()}\n` +
            `stderr: ${Buffer.concat(stderrChunks).toString()}`,
        ),
      )
    }, timeoutMs)

    child.on('error', (error) =>
      fail(new Error('Subprocess spawn/process failure', { cause: error })),
    )
    if (onReady) {
      child.once('message', (message) => {
        readyWork = (async () => {
          try {
            assert.strictEqual(message, 'ready')
            await onReady(child)
          } catch (error) {
            fail(error)
          }
        })()
      })
    }
    for (const [name, chunks] of [
      ['stdout', stdoutChunks],
      ['stderr', stderrChunks],
    ]) {
      child[name].on('data', (chunk) => {
        chunks.push(chunk)
        if (debug) process[name].write(chunk)
      })
      child[name].on('error', (error) =>
        fail(new Error(`Subprocess ${name} stream failure`, { cause: error })),
      )
    }

    // Unlike 'exit', 'close' waits for both output streams to close. Always run
    // both expectations, including on empty output, so silence cannot pass.
    child.once('close', async (code, signal) => {
      await readyWork
      if (isSettled) return
      isSettled = true
      clearTimeout(watchdog)
      try {
        if (onReady) assert.ok(readyWork, 'Subprocess never became ready')
        stdoutExpectation(Buffer.concat(stdoutChunks))
        stderrExpectation(Buffer.concat(stderrChunks))
        assert.strictEqual(code, exitCodeExpectation)
        assert.strictEqual(signal, exitSignalExpectation)
        resolve()
      } catch (error) {
        reject(error)
      }
    })
  })
