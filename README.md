# @hypercliq/shutdown-cleanup

[![npm](https://img.shields.io/npm/v/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
[![npm downloads](https://img.shields.io/npm/dw/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
[![CI](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml/badge.svg)](https://github.com/hypercliq/shutdown-cleanup/actions/workflows/node.js.yml)
[![license](https://img.shields.io/npm/l/@hypercliq/shutdown-cleanup)](LICENSE)

Phased graceful shutdown for Node.js — register async cleanup handlers that run in order when your process receives `SIGTERM`, `SIGINT`, `SIGHUP`, or `beforeExit`.

## Quick start

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  await server.close()
  await db.disconnect()
})
```

## Features

- **Phased execution** — group handlers into numbered phases, run in order
- **Signal-specific handlers** — attach custom logic to one signal without triggering full shutdown
- **Sync and async** — both handler types work transparently
- **Error strategies** — `continue` (default) or `stop` on handler failure
- **Shutdown timeout** — force-exits if cleanup hangs (default 30 s)
- **Custom exit codes**
- **TypeScript** declarations included
- **ESM-only**, Node.js ≥ 22

## Installation

```bash
npm install @hypercliq/shutdown-cleanup
# or
yarn add @hypercliq/shutdown-cleanup
# or
pnpm add @hypercliq/shutdown-cleanup
```

## Documentation

Full API reference, phased shutdown examples, signal-specific handlers, error strategies, and best practices in the **[Developer Guide](https://hypercliq.github.io/shutdown-cleanup/DEVGUIDE.html)**.

## License

[MIT](LICENSE)
