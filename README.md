# Shutdown Cleanup _(shutdown-cleanup)_ <!-- omit in toc -->

[![Greenkeeper badge](https://badges.greenkeeper.io/hypercliq/shutdown-cleanup.svg)](https://greenkeeper.io/)
[![Build Status](https://travis-ci.org/hypercliq/shutdown-cleanup.svg?branch=master)](https://travis-ci.org/hypercliq/shutdown-cleanup)
[![npm](https://img.shields.io/npm/v/@hypercliq/shutdown-cleanup)](https://www.npmjs.com/package/@hypercliq/shutdown-cleanup)

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

- [Install](#install)
- [Usage](#usage)
  - [Register a handler](#register-a-handler)
  - [Add a signal or event to listen to](#add-a-signal-or-event-to-listen-to)
  - [Remove a signal or an event](#remove-a-signal-or-an-event)
  - [TypeScript](#typescript)
  - [Uncaught Exceptions & other similar events](#uncaught-exceptions--other-similar-events)
    - [Handle parameter](#handle-parameter)
    - [Debug](#debug)
- [Changelog](#changelog)
- [Contributing](#contributing)
- [License](#license)

## Install

```sh
npm i -S @hypercliq/shutdown-cleanup
```

## Usage

### Register a handler

```js
import { ShutdownCleanup } from 'shutdown-cleanup'
// const ShutdownCleanup = require('shutdown-cleanup').ShutdownCleanup

ShutdownCleanup.registerHandler(() => console.log('This is printed on exit :)'))
```

### Add a signal or event to listen to

```js
ShutdownCleanup.addSignal('uncaughtException')
```

### Remove a signal or an event

```js
ShutdownCleanup.removeSignal('SIGHUP')
```

### TypeScript

TypeScript types are included.

### Uncaught Exceptions & other similar events

It is possible to listen to the `uncaughtException` event, but **_no_** error message will be displayed if the handle function does not explicitly ask for it or we don't enable `debug` (this is also true for other events such as `unhandledRejection`.)

#### Handle parameter

```js
ShutdownCleanup.registerHandler(codeOrError =>
  console.log('This what we got back:', codeOrError)
)
```

By accepting a parameter (in this case `codeOrError`) we can get back from the module either a code/signal or an error.

#### Debug

Another way to see what's going on is to turn `debug` on:

```sh
DEBUG=shutdown-cleanup npm start
```

or Windows

```sh
set DEBUG=shutdown-cleanup & npm start
```

## Changelog

see [CHANGELOG](CHANGELOG.md)

## Contributing

PRs welcome!

## License

Shutdown-Cleanup is licensed under the MIT. See [LICENSE](LICENSE) for more details.
