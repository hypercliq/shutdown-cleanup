# phased-shutdown

[![npm](https://img.shields.io/npm/v/phased-shutdown)](https://www.npmjs.com/package/phased-shutdown)
[![CI](https://github.com/msanguineti/phased-shutdown/actions/workflows/node.js.yml/badge.svg)](https://github.com/msanguineti/phased-shutdown/actions/workflows/node.js.yml)

Graceful shutdown for Node.js with ordered async cleanup phases. Stop accepting requests, drain background work, then close database connections. Handlers run sequentially on shutdown signals, custom process events, or natural `beforeExit`. Set a shutdown deadline and choose how to handle cleanup errors. TypeScript declarations are included.

## Install

The package ships as an ES module and requires **Node.js 22.0.0 or later**.

```sh
npm install phased-shutdown
```

## Minimal example

Save this example as `server.mjs`.

```js
import { createServer } from 'node:http'
import { registerHandler } from 'phased-shutdown'

const server = createServer((_request, response) => response.end('Hello\n'))

registerHandler(
  () =>
    new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error)
        else resolve()
      })
    }),
  { identifier: 'http', phase: 1 },
)

server.listen(3000, '127.0.0.1')
```

Run `node server.mjs` and open `http://127.0.0.1:3000/` to see `Hello`. Press Ctrl+C in the server’s terminal. The cleanup Promise waits for the server to close, and the process exits with code `2` (`SIGINT`).

The [consumer guide](https://msanguineti.github.io/phased-shutdown/DEVGUIDE.html) covers the API, platform limitations, timeout and exit codes, and [migration from `@hypercliq/shutdown-cleanup`](https://msanguineti.github.io/phased-shutdown/DEVGUIDE.html#migrating-from-hypercliq-shutdown-cleanup). See the [guide source](https://github.com/msanguineti/phased-shutdown/blob/main/DEVGUIDE.md) for the version in this repository.

For development setup, validation, and releases, see [Contributing and maintaining](https://github.com/msanguineti/phased-shutdown/blob/main/CONTRIBUTING.md).

## License

[MIT](LICENSE)
