# @hypercliq/shutdown-cleanup

[![npm](https://img.shields.io/npm/v/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
[![CI](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml/badge.svg)](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml)

Phased graceful shutdown for Node.js. Register synchronous or async cleanup handlers; they run sequentially in phase order on shutdown signals, custom process events, or natural `beforeExit`. Includes TypeScript declarations, error strategies, and a shutdown deadline.

## Install

Requires **Node.js >=22.0.0**; ESM-only.

```sh
npm install @hypercliq/shutdown-cleanup
```

## Minimal example

Save as `server.mjs`, run `node server.mjs`, then press Ctrl+C:

```js
import { createServer } from 'node:http'
import { registerHandler } from '@hypercliq/shutdown-cleanup'

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

The Promise waits for HTTP closure; `await server.close()` alone does not. Importing the package installs shutdown listeners immediately. OS trigger behavior varies, especially on Windows; forced termination cannot guarantee cleanup.

See the **[consumer guide](https://hypercliq.github.io/shutdown-cleanup/DEVGUIDE.html)** ([source](https://github.com/hypercliq/shutdown-cleanup/blob/main/DEVGUIDE.md)) for the API, platform limitations, timeout and exit-code policy, and migration notes, including GitHub Packages retirement. [Contributing and maintaining](https://github.com/hypercliq/shutdown-cleanup/blob/main/CONTRIBUTING.md) covers repository setup and releases.

## License

[MIT](LICENSE)
