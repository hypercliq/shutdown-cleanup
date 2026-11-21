# phased-shutdown

[![npm](https://img.shields.io/npm/v/phased-shutdown)](https://www.npmjs.com/package/phased-shutdown)
[![CI](https://github.com/msanguineti/phased-shutdown/actions/workflows/node.js.yml/badge.svg)](https://github.com/msanguineti/phased-shutdown/actions/workflows/node.js.yml)

Graceful shutdown for Node.js with ordered async cleanup phases. Stop accepting requests, drain background work, then close database connections. Handlers run sequentially on shutdown signals, custom process events, or natural `beforeExit`. Set a shutdown deadline and choose how to handle cleanup errors. TypeScript declarations are included.

## Install

Requires **Node.js >=22.0.0**; ESM-only.

```sh
npm install phased-shutdown
```

## Minimal example

Save as `server.mjs`, run `node server.mjs`, then press Ctrl+C:

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

The Promise waits for HTTP closure.

See the **[consumer guide](https://msanguineti.github.io/phased-shutdown/DEVGUIDE.html)** ([source](https://github.com/msanguineti/phased-shutdown/blob/main/DEVGUIDE.md)) for the API, platform limitations, timeout and exit-code policy, and migration notes, including [how to migrate from `@hypercliq/shutdown-cleanup`](https://github.com/msanguineti/phased-shutdown/blob/main/DEVGUIDE.md#migrating-from-hypercliq-shutdown-cleanup).

## License

[MIT](LICENSE)
