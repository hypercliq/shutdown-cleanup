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
npm run lint
npm test
npm run test:consumer
```

`npm test` checks TypeScript declarations and runs the runtime suite. `npm run test:runtime` runs only the built-in Node test suite and needs no development dependencies. `npm run test:consumer` packs the package with hooks disabled, installs the tarball in a temporary ESM consumer with strict engine checks and no development dependencies, and runs the same runtime suite through the package's public exports. It cleans up the temporary consumer afterward. Test subprocesses use the current Node executable.

CI packs with Node.js 24/npm 11 before testing the consumer on exact Node.js **22.0.0** plus moving **22.x** and **24.x** releases. This avoids an older npm 10 bug that runs `prepare` despite `--ignore-scripts`; consumer jobs never install development dependencies. A separate toolchain job installs development dependencies with strict engine checks, lints, and checks runtime behavior and declarations on exact **22.22.1** and moving **24.x**. To reproduce the runtime floor locally, pass a tarball made with the development toolchain:

```bash
package_archive=$(HUSKY=0 npm pack --ignore-scripts --foreground-scripts=false)
nvm exec 22.0.0 npm run test:consumer -- "./$package_archive"
```

## Compatibility and releases

Keep `engines.node` tied to consumer runtime requirements. A higher development-toolchain requirement alone does not justify raising it. When updating tools, recheck their locked engine requirements and update `.nvmrc`, CI, and this guide together. Preserve the exact runtime-floor CI entry and the Node 22 type baseline while that runtime remains supported.

This alignment preserves support for every Node.js version already covered by `>=22`; spelling it `>=22.0.0` does not narrow support and needs no breaking release. If a future runtime feature cannot be accommodated with a small compatible fix, dropping any previously supported Node version is a breaking change: document the removed versions and migration requirement in release notes and ship it in a new major release.
