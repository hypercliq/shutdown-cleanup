# @hypercliq/shutdown-cleanup

[![npm](https://img.shields.io/npm/v/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
[![npm downloads](https://img.shields.io/npm/dw/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
[![CI](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml/badge.svg)](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml)
[![license](https://img.shields.io/npm/l/@hypercliq/shutdown-cleanup)](LICENSE)

Phased graceful shutdown for Node.js — register async cleanup handlers that run in order when your process receives `SIGTERM`, `SIGINT`, `SIGHUP`, or `beforeExit`.

## Quick start

Save this runnable example as `server.mjs` after installing the package, then run `node server.mjs` (Node.js 22.0.0+). It uses only the package and Node built-ins.

```js
import { once } from 'node:events'
import { createServer } from 'node:http'
import {
  registerHandler,
  setCustomExitCode,
  setErrorHandlingStrategy,
  setShutdownTimeout,
} from '@hypercliq/shutdown-cleanup'

const server = createServer((_request, response) => {
  response.end('Hello\n')
})

const closeHttpServer = () =>
  new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })

setShutdownTimeout(20_000)
setErrorHandlingStrategy('stop')
setCustomExitCode(0)

registerHandler(closeHttpServer, { identifier: 'closeServer', phase: 1 })
registerHandler(() => console.log('HTTP server closed'), { phase: 2 })

server.listen(0, '127.0.0.1')
await once(server, 'listening')
console.log(`Listening at http://127.0.0.1:${server.address().port}`)
console.log(`Send SIGTERM to PID ${process.pid}, or press Ctrl+C`)
```

Node's HTTP `server.close()` returns the server, not a Promise. The wrapper waits for its callback before phase 2 runs. See [Node.js HTTP closure semantics](https://nodejs.org/api/http.html#serverclosecallback).

Importing the package immediately attaches process listeners for `SIGTERM`, `SIGHUP`, `SIGINT`, and `beforeExit`, even without registered handlers. Shutdown awaits each handler sequentially, including handlers in the same phase. A terminating signal-specific handler runs first under the same deadline; further terminating events are ignored. Handlers with `shouldTerminate: false` remain repeatable, can overlap, and start no timeout.

`beforeExit` requires the event loop to drain: a listening HTTP server prevents it. It does not cover explicit `process.exit()` or uncaught exceptions. By default, successful signal cleanup exits with the signal number (not `128 + signal number`); timeout or `stop` on error exits with `1`. The example sets a custom code of `0`, which also overrides failure exits. See the guide's [exit-code policy](https://hypercliq.github.io/shutdown-cleanup/DEVGUIDE.html#custom-exit-codes).

For diagnostic logs, run `DEBUG=shutdown-cleanup node server.mjs`. `DEBUG` is read at import time; see the guide for matching rules.

## Features

- **Phased execution** — group handlers into numbered phases, run in order
- **Signal-specific handlers** — attach custom logic to one signal; set `shouldTerminate: false` to keep running
- **Sync and async** — both handler types work transparently
- **Error strategies** — `continue` (default) or `stop` on handler failure
- **Shutdown timeout** — force-exits if cleanup hangs (default 30 s)
- **Custom exit codes**
- **TypeScript** declarations included
- **ESM-only**, Node.js ≥ 22.0.0

## Installation

```bash
npm install @hypercliq/shutdown-cleanup
# or
yarn add @hypercliq/shutdown-cleanup
# or
pnpm add @hypercliq/shutdown-cleanup
```

### GitHub Packages retirement

From **6 October 2026**, new releases are published only to npm. **8.0.3** is the final GitHub Packages release; already-published versions remain available.

If you use GitHub Packages, update your project's `.npmrc` mapping and refresh registry URLs in your lockfile:

```ini
@hypercliq:registry=https://registry.npmjs.org/
```

Check other `@hypercliq` dependencies before changing this scope-wide mapping. Version `8.0.0` is available only on GitHub Packages; keep its existing registry or test a compatible npm version.

## Documentation

Full API reference, phased shutdown examples, signal-specific handlers, error strategies, and best practices in the **[Developer Guide](https://hypercliq.github.io/shutdown-cleanup/DEVGUIDE.html)** ([repository source](https://github.com/hypercliq/shutdown-cleanup/blob/main/DEVGUIDE.md)).

For repository setup and the separate development-toolchain minimum (Node.js 22.22.1 on the 22.x line, or 24+), see [Contributing](https://github.com/hypercliq/shutdown-cleanup/blob/main/CONTRIBUTING.md).

Upgrading from version 7? Version 8 raises the consumer runtime minimum from Node.js 18 to 22.0.0. See [migration guidance](https://hypercliq.github.io/shutdown-cleanup/DEVGUIDE.html#migration-from-older-versions).

## License

[MIT](LICENSE)
