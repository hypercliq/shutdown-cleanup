# Repository instructions

- Use Node.js 22.22.1 (`.nvmrc`) or 24+ for development; package consumers require Node.js >=22.0.0.
- Setup: `npm ci --engine-strict`. Main gate: `npm run check`; consumer check: `npm run test:consumer`.
- Runtime/signal tests must run in child processes. See `tests/subprocess-helper.js` and `tests/test-script.js`.
- Keep `index.js`, `index.d.ts`, and package exports aligned. See [CONTRIBUTING.md](CONTRIBUTING.md) for fixture and compatibility conventions.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md#releases) for release work. Never publish without explicit user authorization.
