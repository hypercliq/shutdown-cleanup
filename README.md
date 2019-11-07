# Shutdown Cleanup <!-- omit in toc -->

Module to handle applications' graceful shutdowns.

- [Description](#description)
- [Installation](#installation)
- [Usage](#usage)
  - [Register a handler](#register-a-handler)
  - [Add a signal or event to listen to](#add-a-signal-or-event-to-listen-to)
  - [Remove a signal or an event](#remove-a-signal-or-an-event)
  - [TypeScript](#typescript)
- [Uncaught Exceptions & other similar events](#uncaught-exceptions--other-similar-events)
- [Changelog](#changelog)
- [License](#license)

## Description

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

## Installation

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

## Uncaught Exceptions & other similar events

It is possible to listen to the `uncaughtException` event, but **_no_** error message will be displayed.

In order to see what's going on, it is necessary to turn `debug` on:

```sh
DEBUG=shutdown-cleanup npm start
```

or Windows

```sh
set DEBUG=shutdown-cleanup & npm start
```

This is also true for other events such as `unhandledRejection`.

## Changelog

see [CHANGELOG](CHANGELOG.md)

## License

Shutdown-Cleanup is licensed under the MIT. See [LICENSE](LICENSE) for more details.
