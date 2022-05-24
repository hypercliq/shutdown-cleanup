# ![ShutdownCleanup](logo.png) <!-- omit in toc -->

[![npm](https://badgen.net/npm/v/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)
![npm downloads](https://badgen.net/npm/dt/@hypercliq/shutdown-cleanup)
![types](https://badgen.net/npm/types/@hypercliq/shutdown-cleanup)
![Dependabot](https://badgen.net/github/dependabot/hypercliq/shutdown-cleanup?icon=dependabot)
[![BCH compliance](https://bettercodehub.com/edge/badge/hypercliq/shutdown-cleanup?branch=main)](https://bettercodehub.com/)
[![Node.js CI](https://github.com/hypercliq/shutdown-cleanup/workflows/Node.js%20CI/badge.svg)](https://github.com/hypercliq/shutdown-cleanup/)
![CodeQL](https://github.com/hypercliq/shutdown-cleanup/workflows/CodeQL/badge.svg)

> Module to handle applications' graceful shutdowns.

This super simple module helps shutting down servers, database handles, etc. in NodeJS applications.
It allows to register handlers for certain shutdown signals/events in order to attempt a graceful shutdown (clean-ups etc.)

NOTE: it removes any previous registered listeners for the given signals!

By default it listens to:
`SIGTERM`
`SIGHUP`
`SIGINT`

It also listens to `process.exit` but keep in mind that `exit` does
not allow asynchrounous listeners' operations to complete (see [process.exit on NodeJS.org](https://nodejs.org/dist/latest/docs/api/process.html#process_event_exit))

It is also possible to add (or remove) other shutdown signals/events.

## Table of Contents <!-- omit in toc -->

- [Node compatibility](#node-compatibility)
- [Install](#install)
- [Usage](#usage)
  - [Register a handler](#register-a-handler)
    - [Handler function](#handler-function)
  - [Add a signal or event to listen to](#add-a-signal-or-event-to-listen-to)
  - [Remove a signal or an event](#remove-a-signal-or-an-event)
  - [List signals and events listened to](#list-signals-and-events-listened-to)
- [TypeScript](#typescript)
- [Uncaught Exceptions & other similar events](#uncaught-exceptions--other-similar-events)
  - [Debug](#debug)
- [Exit codes](#exit-codes)
- [Contributing](#contributing)
- [License](#license)

## Node compatibility

Tested in [nodejs](https://nodejs.org) version:

- 14
- 16 (see [Exit codes](#exit-codes))
- 18

**Version `4.0.0` drops compatibility with node <= 10.**

**Version `5.0.0` drops compatibility with node <= 12.**

## Install

```sh
npm i -S @hypercliq/shutdown-cleanup
```

## Usage

### Register a handler

```js
import {
  registerHandler,
  addSignal,
  removeSignal,
  listSignals,
} from 'shutdown-cleanup'

registerHandler(() => console.log('This is printed on exit :)'))
```

#### Handler function

```js
type HandlerFunction = (
  signal?: SignalsEvents | Error | number
) => void | Promise<void>
```

The optional parameter `signal` will be set to what caused the program to exit (see [exit codes](#exit-codes)).

```js
registerHandler((signal) => console.log('This is what we got back:', signal))
```

### Add a signal or event to listen to

```js
addSignal('uncaughtException')
```

### Remove a signal or an event

```js
removeSignal('SIGHUP')
```

### List signals and events listened to

```js
listSignals()
```

## TypeScript

TypeScript types are included.

## Uncaught Exceptions & other similar events

It is possible to listen to the `uncaughtException` event, but **_no_** error message will be displayed if the handle function does not explicitly ask for it or we don't enable `debug` (this is also true for other events such as `unhandledRejection`.)

### Debug

Another way to see what's going on is to turn `debug` on:

```sh
DEBUG=shutdown-cleanup npm start
```

or Windows

```sh
set DEBUG=shutdown-cleanup & npm start
```

**shutdown-cleanup** does **_not_** depend on [debug](https://www.npmjs.com/package/debug) while being fully compatible with it. This means that it works with or without `debug` as a dependency.

```sh
# compatible with debug
DEBUG=* npm start
```

## Exit codes

In previous versions, `shutdown-cleanup` returned an exit code of `1` whenever an exit code (error number) was `undefined` or was `0`. This behaviour has changed from `v3.1.13`.

Now, `shutdown-cleanup` relays the code number associated with the signal that caused `node` to terminate.

In some cases (e.g. when signal is an `Error`), the code number (`errno`) might be `undefined`. In those cases, `shutdown-cleanup` sets the exit code to `0x99`

For node versions \*less than **v15\***, `shutdown-cleanup` reports `unhandledRejection` exit code as `0`. This is in line with what node is actually returning. In fact, `unhandledRejection` produces this deprecation warning:

```sh
DeprecationWarning: Unhandled promise rejections are deprecated. In the future, promise rejections that are not handled will terminate the Node.js process with a non-zero exit code.
```

## Contributing

PRs welcome!

## License

Shutdown-Cleanup is licensed under the MIT. See [LICENSE](LICENSE) for more details.
