# Contributing

## Setup and checks

The package supports Node.js **>=22.0.0**. Development tools require Node.js **22.22.1 on 22.x or 24+**; `.nvmrc` selects 22.22.1. Node.js 23 is not supported by the toolchain.

```sh
nvm install
nvm use
npm ci --engine-strict
npm run check
npm run test:consumer
```

`npm run check` covers formatting, lint, types, release-policy tests, runtime coverage, and the packed-package check. `npm run test:consumer` installs a packed tarball into a temporary ESM project and runs runtime tests through its public exports. CI also checks that package on Node.js 22.0.0, current 22.x, and current 24.x.

## Repository map

- `index.js`, `index.d.ts`: published runtime and TypeScript declarations.
- `tests/`: runtime, subprocess, type, and release-policy tests.
- `scripts/`: isolated consumer/package checks and release validation.
- `.github/workflows/`: CI and npm/Pages release automation.
- `DEVGUIDE.md`: consumer API guide; `RELEASING.md`: maintainer release procedure.

## Tests and fixtures

Keep process behavior tests isolated in child processes: importing the package attaches process listeners, and signal/exit tests can affect the test runner. Use `tests/subprocess-helper.js` for bounded subprocess execution and `tests/test-script.js` for child scenarios. Keep TypeScript declaration fixtures in `tests/types.ts`; `npm run test:types` checks them with strict NodeNext settings. Put reusable package-consumer fixtures in `scripts/` and keep generated archives and coverage output out of source control.

## Public API compatibility

`index.js`, `index.d.ts`, `package.json` exports, and `engines.node` define the public contract. Keep declarations aligned with runtime exports and test changes through the packed consumer. Do not raise the consumer Node minimum just to satisfy development tools. Removing or changing supported APIs, or dropping a supported Node version, requires a major release and migration notes.

## Releases

Follow [RELEASING.md](RELEASING.md) for versioning, validation, publishing, and recovery. Do not duplicate its release steps here.
