# Repository instructions

## Lead’s account

**Current state.** `phased-shutdown` provides ordered asynchronous cleanup on process signals, custom events, and `beforeExit`. It ships as an ES module with TypeScript declarations and requires Node.js 22.0.0 or later. Native signal delivery varies by platform, and forced termination can cut cleanup short. See the [consumer guide](DEVGUIDE.md#platforms-and-limitations).

**Direction.** Maintain `phased-shutdown` as the npm successor to `@hypercliq/shutdown-cleanup`. Preserve the documented consumer contract and verify the packed package across the supported Node.js and OS matrix before release.

## Decisions and constraints

- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for Node.js setup, checks, fixtures, platform validation, and releases.
- Keep `index.js`, `index.d.ts`, and package exports aligned. Run runtime and signal tests in child processes.
- Never publish without explicit user authorization.

## Scratch

Use the Git-ignored `scrap/` directory for work plans, experiments, and temporary notes. Create it as needed in a fresh checkout.
