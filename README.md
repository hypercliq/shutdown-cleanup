# Shutdown-Cleanup Module

![npm](https://img.shields.io/npm/v/@hypercliq/shutdown-cleanup)
![npm](https://img.shields.io/npm/dw/@hypercliq/shutdown-cleanup)
![NPM](https://img.shields.io/npm/l/@hypercliq/shutdown-cleanup)

The `shutdown-cleanup` module provides a structured approach for managing graceful shutdowns in Node.js applications. It supports phased shutdowns, signal-specific handlers, customizable error handling strategies, and custom exit codes, ensuring broad compatibility with LTS Node.js versions.

## Features

- **Phased Shutdown:** Organizes shutdown logic into phases for orderly execution.
- **Signal-Specific Handlers:** Custom logic for specific signals without mandatory shutdown.
- **Error Handling Strategy:** Customizable handling of handler errors.
- **Custom Exit Codes:** Specify exit codes to indicate shutdown statuses.
- **Graceful Shutdown with Timeout:** Prevents indefinite hangs during shutdown. (See [Developer Guide](docs/DEVGUIDE.md) for details.)
- **LTS Node.js Support:** Compatible with LTS Node.js versions.
- **Enhanced Flexibility:** Supports handling of custom application events.
- **TypeScript Support:** Includes TypeScript definitions for ease of development.

## Installation

```bash
npm install @hypercliq/shutdown-cleanup
```

Or using Yarn:

```bash
yarn add @hypercliq/shutdown-cleanup
```

## Usage

To use `shutdown-cleanup`, import and utilize its functions within your application to manage shutdown logic effectively.

```js
import { registerHandler } from '@hypercliq/shutdown-cleanup'

registerHandler(async (signal) => {
  await performCleanup()
  console.log('Cleanup completed')
})
```

## Examples and Best Practices

For more detailed usage examples and best practices, see the [Developer Guide](docs/DEVGUIDE.md).

## Contributing

Contributions are welcome! Please submit issues and pull requests to propose changes, report bugs, or suggest new features. For major changes, open an issue first to discuss what you would like to change.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
