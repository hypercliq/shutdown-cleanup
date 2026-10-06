# Repository instructions

- Use Node.js 22.22.1 (`.nvmrc`) or 24+ for development; package consumers require Node.js >=22.0.0.
- Setup: `npm ci --engine-strict`. Quick tests: `npm test`. Complete pre-PR gate: `npm run check` (includes installed-package validation). `test:consumer` is the runtime-only platform CI entry point.
- Runtime/signal tests must run in child processes. See `tests/subprocess-helper.js` and `tests/test-script.js`.
- Keep `index.js`, `index.d.ts`, and package exports aligned. See [CONTRIBUTING.md](CONTRIBUTING.md) for fixture and compatibility conventions.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md#releases) for release work. Never publish without explicit user authorization.
