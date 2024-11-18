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
- **Graceful Shutdown with Timeout:** Prevents indefinite hangs during shutdown. (See [Developer Guide](DEVGUIDE.md) for details.)
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

For more detailed usage examples and best practices, see the [Developer Guide](DEVGUIDE.md).

## Contributing to Shutdown-Cleanup

We encourage contributions! If you have suggestions, bug reports, or would like to contribute code, please submit issues or pull requests on GitHub. For major changes, start by opening an issue to discuss your ideas.

Thank you for using and contributing to the `shutdown-cleanup` module!

### How to Contribute

1. Fork the repository
2. Create a new branch for your feature or bug fix
3. Make your changes
4. Commit your changes
5. Push your changes to your fork
6. Open a pull request
7. Wait for review and merge
8. Celebrate your contribution!

Remember to add tests for your changes and ensure that all tests pass before submitting a pull request. Also lint and format your code according to the project's standards.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
