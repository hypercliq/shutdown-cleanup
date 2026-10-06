# Contributing

## Node.js versions

The published package supports **Node.js >=22.0.0**. Runtime code uses Map iterator helpers (`some`, `filter`, and `toArray`) and `Array.prototype.toSorted`. Node.js 22.0.0 ships these helpers with V8 12.4; see the [Node.js 22 announcement](https://nodejs.org/en/blog/announcements/v22-release-announce). No flags or polyfills are required. The package has no runtime dependencies.

The development toolchain has a separate minimum: **22.22.1 on Node.js 22.x, or Node.js >=24**. Node.js 23 does not satisfy ESLint's engine range. The current locked requirements include:

| Tool           | Node.js requirement          |
| -------------- | ---------------------------- |
| commitlint 21  | >=22.12.0                    |
| c8 12          | ^20.19.0 or ^22.12.0 or >=23 |
| ESLint 10      | ^20.19.0 or ^22.13.0 or >=24 |
| lint-staged 17 | >=22.22.1                    |

Together these requirements set the development floor at 22.22.1. `.nvmrc` pins that version, and release validation uses it. Publication keeps Node.js 24 with its bundled npm 11. `@types/node` stays on major 22 to reflect the supported runtime API baseline rather than newer Node APIs. These are development dependencies and do not raise the published package's runtime minimum.

## Setup and checks

```bash
nvm install
nvm use
npm ci --engine-strict
npm run check
npm run test:consumer
```

`npm test` checks TypeScript declarations and runs the runtime suite. `npm run test:runtime` runs only the built-in Node test suite and needs no development dependencies. `npm run test:consumer` packs the package with hooks disabled, installs the tarball in a temporary ESM consumer with strict engine checks and no development dependencies, and runs the same runtime suite through the package's public exports. It cleans up the temporary consumer afterward. Test subprocesses use the current Node executable.

`npm run test:package` always packs current source into a temporary directory, enforces the exact five-file archive (`LICENSE`, `README.md`, `index.js`, `index.d.ts`, and `package.json`), installs it in a separate ESM consumer, verifies all named exports and phased asynchronous SIGTERM shutdown with a custom exit code in a bounded child process, and compiles the TypeScript fixture against the installed declarations. It uses the repository compiler and Node ambient types as tooling, with strict NodeNext resolution and declaration checking enabled. The consumer and archive are removed on success or failure. This check requires the development dependencies and the `tar` command; it never publishes.

`npm run check` is the shared, non-mutating contributor and CI gate: formatting, JavaScript linting, TypeScript validation, the runtime suite with coverage, and the isolated package smoke check. `npm run format:check` checks all Prettier-supported maintained files, including declarations, TypeScript fixtures, documentation, JSON (including the lockfile), YAML workflows, and JavaScript configuration files. `.prettierignore` excludes dependencies, generated coverage/site output, archives, logs, and local `scrap` experiments. `npm run format` remains an explicit local formatting command; CI never writes formatting changes.

`npm run lint` includes maintained JavaScript configuration files as well as source, tests, and scripts. TypeScript declarations and fixtures are intentionally excluded from ESLint: `npm run test:types` validates them with strict `tsc --noEmit`, including the fixture's negative `@ts-expect-error` assertions. The pre-commit hook runs ESLint fixes only on staged JavaScript and Prettier on supported staged files using the same formatting exclusions. Run `npm run check` before submitting; staged TypeScript formatting alone does not validate its types.

Coverage uses c8 with `all` enabled and includes only the published runtime source, `index.js`; tests, scripts, declarations, and configuration files are outside the runtime coverage denominator. Each `npm run test:coverage` clears raw coverage before running the full runtime/subprocess suite, then writes HTML, LCOV, JSON summary, and console reports under `coverage/`. CI uploads reports separately for each toolchain version. The validated Linux baseline on Node.js 22.22.1 and 24.18.0 is 97.76% lines/statements (437/447), 97.36% branches (148/152), and 100% functions (19/19). The thresholds in `.c8rc.json` round the partial metrics down to 97% and retain 100% functions, allowing small V8 measurement differences without adopting an arbitrary lower target. No assertions or source coverage exclusions were changed to obtain this baseline.

CI runs on pull requests targeting `main`, pushes to `main`, and merge-queue `merge_group` checks when a queue is used. CI packs with Node.js 24/npm 11 before testing the consumer on exact Node.js **22.0.0** plus moving **22.x** and **24.x** releases. This avoids an older npm 10 bug that runs `prepare` despite `--ignore-scripts`; consumer jobs never install development dependencies. A separate toolchain job installs development dependencies with strict engine checks and runs `npm run check` on exact **22.22.1** and moving **24.x**. Release validation runs the same gate plus the consumer check. To reproduce the runtime floor locally, pass a tarball made with the development toolchain:

```bash
package_archive=$(HUSKY=0 npm pack --ignore-scripts --foreground-scripts=false)
nvm exec 22.0.0 npm run test:consumer -- "./$package_archive"
```

## Compatibility and releases

Keep `engines.node` tied to consumer runtime requirements. A higher development-toolchain requirement alone does not justify raising it. When updating tools, recheck their locked engine requirements and update `.nvmrc`, CI, and this guide together. Preserve the exact runtime-floor CI entry and the Node 22 type baseline while that runtime remains supported.

This alignment preserves support for every Node.js version already covered by `>=22`; spelling it `>=22.0.0` does not narrow support and needs no breaking release. If a future runtime feature cannot be accommodated with a small compatible fix, dropping any previously supported Node version is a breaking change: document the removed versions and migration requirement in release notes and ship it in a new major release.

## Release workflow and recovery

See [Releasing](RELEASING.md) for publishing, prerelease rules, and recovery. `npm run check` includes the offline release tests.
