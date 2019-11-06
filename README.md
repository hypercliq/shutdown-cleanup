# shutdown-cleanup <!-- omit in toc -->

Module to handle applications' graceful shutdowns.

- [Description](#description)
- [Installation](#installation)
- [Usage](#usage)
  - [Register a handler](#register-a-handler)
  - [Add a signal/event to listen to](#add-a-signalevent-to-listen-to)
  - [Remove a signal/event](#remove-a-signalevent)
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

**TypeScript** types included.

## Installation

```sh
npm i -S shutdown-cleanup
```

## Usage

### Register a handler

```js
import { ShutdownCleanup } from 'shutdown-cleanup'
// const ShutdownCleanup = require('shutdown-cleanup').ShutdownCleanup

ShutdownCleanup.registerHandler(() => console.log('This is printed on exit :)'))
```

### Add a signal/event to listen to

```js
ShutdownCleanup.addSignal('unhandledException')
```

### Remove a signal/event

```js
ShutdownCleanup.removeSignal('SIGHUP')
```

## License

Shutdown-Cleanup is licensed under the MIT. See [LICENSE](LICENSE) for more details.
