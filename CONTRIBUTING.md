# Contributing and maintaining

## Setup and checks

Consumers require Node.js >=22.0.0. Development requires **22.22.1 on 22.x or 24+**; `.nvmrc` selects 22.22.1. Node.js 23 is not supported by the toolchain.

```sh
nvm install
nvm use
npm ci --engine-strict
npm test          # Quick feedback: declarations and runtime/native tests
npm run check    # Complete pre-PR validation
```

`npm test` is the quick test command. `npm run check` is the complete pre-PR gate: formatting, lint, declarations, release policy, runtime coverage, and packed-package validation. It packs and installs the package once in a temporary ESM project, then checks archive contents, public ESM exports, declaration resolution, and the full runtime/native suite through the installed package. Temporary resources are removed on success or failure.

The `test:*` scripts are internal components for focused debugging and CI; contributors do not need a separate package-validation command. Platform CI uses `npm run test:consumer -- /path/to/package.tgz` to run only the installed runtime/native suite on Node >=22.0.0, without installing the development toolchain. To run the complete gate against an existing archive, use `npm run check -- /path/to/package.tgz`. Both entry points use the supplied archive without repacking, or create one when no archive is supplied.

CI runs `check:source` once on `.nvmrc`, packs once, then runs `test:package -- <archive> --skip-runtime` for archive contents, ESM exports, and installed declaration resolution. The ensuing platform matrix runs the full installed runtime/native suite. Local `npm run check` still includes that suite. Manual validation is available through **Node.js CI → Run workflow**.

## Changes and fixtures

Keep `index.js`, `index.d.ts`, package exports, and `engines.node` aligned. Test through the packed consumer; do not raise the consumer minimum to satisfy development tools. Breaking API/runtime changes require a major release and migration notes in [the consumer guide](DEVGUIDE.md#compatibility-and-migration).

Runtime/signal tests must use child processes: imports attach listeners, and exits/signals can affect the runner. Use `tests/subprocess-helper.js` for bounded execution and `tests/test-script.js` for scenarios. Strict NodeNext declaration fixtures live in `tests/types.ts`; run `npm run test:types`. Reusable package fixtures belong in `scripts/`; do not commit generated archives or coverage.

`test:portable` covers custom events/lifecycle behavior; `test:signals` covers actual OS delivery with `tests/signal-fixture.js`; `test:runtime` runs both. Never replace native delivery with `process.emit`. Windows tests require PowerShell and genuine console creation; native failures must fail the test. Excluded signals have explicit reasons in `tests/signal-policy.js`.

## Platform validation

CI tests the packed package on Linux, Windows, macOS ARM64, and macOS Intel x64 with Node 22.0.0, current 22.x, 24.x, and 26.x. All sixteen entries are required for publication; one shared matrix and support gate require every target to succeed. Logs/artifacts record the actual host, architecture, Node version, results, and skips. Runner coverage does not certify every OS version, architecture, terminal, or service host.

PR validation cancels superseded runs of the same PR; release execution uses a separate concurrency group and never cancels an active publication.

### CI execution inventory

Counts compare the workflows at `4e51d82` with the consolidated workflows, for a complete run. Expanded jobs include all sixteen platform entries and the support gate. Failed-job reruns reuse the original archive; a full rerun produces one new archive named for its attempt.

| Work per workflow                                                   | CI before → after | Release before → after             |
| ------------------------------------------------------------------- | ----------------- | ---------------------------------- |
| Expanded jobs                                                       | 20 → 18           | 20 → 20 stable; 19 → 20 prerelease |
| Development toolchain jobs / dependency installs                    | 3 → 1             | 1 → 1                              |
| Pack operations                                                     | 19 → 1            | 2 → 1                              |
| Formatting, lint, source declarations, release-policy suites (each) | 3 → 1             | 1 → 1                              |
| Source runtime/native suites with coverage                          | 3 → 1             | 1 → 1                              |
| Installed-package contents, ESM exports, declaration checks         | 3 → 1             | 1 → 1                              |
| Full installed runtime/native suites                                | 19 → 16           | 17 → 16                            |

Historical durations available on 2026-10-06: [PR run 37370952905](https://github.com/hypercliq/shutdown-cleanup/actions/runs/37370952905) took 15m 04s (failure, 2026-10-05); [release run 30565818421](https://github.com/hypercliq/shutdown-cleanup/actions/runs/30565818421) took 10m 58s (failure, 2026-07-30). Both used older workflows than this checkout and are not a comparable baseline. The first consolidated [PR #1655 run](https://github.com/hypercliq/shutdown-cleanup/actions/runs/37453673984) took 2m 42s (failure, 2026-10-06): the development job, all four Linux jobs and all eight macOS jobs passed; every Windows job timed out in the seven Ctrl+C cases, so the support gate failed. The subsequent [verification run on `7d4b817`](https://github.com/hypercliq/shutdown-cleanup/actions/runs/37455281093) passed all sixteen platform entries, including all eight macOS architecture/Node combinations, in 2m 36s; no comparable-baseline speedup is claimed.

## Releases

New releases publish to npm only. Obtain explicit user authorization before publishing a GitHub release or package.

1. Update `package.json` and both root versions in `package-lock.json`; run `npm run check`.
2. Require the intended revision's complete Linux/Windows/macOS ARM64/Intel CI matrix, including native signal, console, and forced-termination results.
3. When authorized, tag that commit `v<version>` and publish its GitHub release (mark suffixed versions as prereleases).

Automation checks release metadata and the development toolchain, then packs once. That archive and its SHA-512 checksum pass through installed-package checks, the platform matrix, and npm publication. Failed, skipped, or cancelled required validation blocks publication. Pages additionally requires successful npm publication. Stable releases use `latest`; prereleases use `next`. Build metadata is unsupported; promotion needs a new stable version.

Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for repository `hypercliq/shutdown-cleanup`, workflow `npmpublish.yml`, no environment, and direct `npm publish` allowed. Publication uses a GitHub-hosted runner, Node.js 24, npm >=11.5.1, and OIDC without an npm token.

### Recovery

Use **Re-run failed jobs** to reuse the validated archive and checksum (retained 30 days); if expired, rerun all jobs on the original tagged commit. An already-published version with matching integrity is skipped; different contents or unavailable registry metadata stop publication. Never overwrite a version or move its tag: changed contents require a new version.

Recovery leaves existing dist-tags unchanged and refuses to move `latest`/`next` backwards. Repair missing tags separately after inspecting registry state. Historical runs retain old workflows: do not rerun retired GitHub Packages publication jobs or redeploy older Pages docs.

## Documentation and Pages

README provides installation and the runnable example; `DEVGUIDE.md` owns consumer behavior, API, and migrations. This guide owns development and release procedures; `AGENTS.md` contains short agent instructions.

Pages builds only the allowlisted README (as `index.md`), consumer guide, license, logo, and Jekyll configuration. Keep the staging list in `npmpublish.yml` explicit; repository scripts, tools, and maintainer/agent guides must not enter the site. For documentation changes, build the staged source locally with Jekyll, inspect its generated files and internal links, and do not deploy as part of validation.

Documentation follows every published release, including prereleases. Before deploying, automation checks the complete GitHub release inventory by publication time, including prereleases; superseded releases skip deployment and unavailable evidence stops it. Release runs are serialized, so stale reruns cannot replace newer documentation. Pages artifacts and platform logs include the attempt number to support recovery without artifact-name collisions.
