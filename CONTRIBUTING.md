# Contributing and maintaining

## Setup and checks

Consumers require Node.js >=22.0.0. Development requires **22.22.1 on 22.x or 24+**; `.nvmrc` selects 22.22.1. Node.js 23 is not supported by the toolchain.

```sh
nvm install
nvm use
npm ci --engine-strict
npm run check
npm run test:consumer
```

`check` covers formatting, lint, types, release policy, runtime coverage, and package contents. `test:consumer` installs a tarball in a temporary ESM project and tests public exports.

## Changes and fixtures

Keep `index.js`, `index.d.ts`, package exports, and `engines.node` aligned. Test through the packed consumer; do not raise the consumer minimum to satisfy development tools. Breaking API/runtime changes require a major release and migration notes in [the consumer guide](DEVGUIDE.md#compatibility-and-migration).

Runtime/signal tests must use child processes: imports attach listeners, and exits/signals can affect the runner. Use `tests/subprocess-helper.js` for bounded execution and `tests/test-script.js` for scenarios. Strict NodeNext declaration fixtures live in `tests/types.ts`; run `npm run test:types`. Reusable package fixtures belong in `scripts/`; do not commit generated archives or coverage.

`test:portable` covers custom events/lifecycle behavior; `test:signals` covers actual OS delivery with `tests/signal-fixture.js`; `test:runtime` runs both. Never replace native delivery with `process.emit`. Windows tests require PowerShell and genuine console creation; native failures must fail the test. Excluded signals have explicit reasons in `tests/signal-policy.js`.

## Platform validation

CI tests the packed package on Linux and Windows with Node 22.0.0, current 22.x, 24.x, and 26.x. All entries are required for publication. macOS ARM64 and Intel x64 run the same versions as exploratory candidates with `continue-on-error`; their failures are retained but do not block release. Logs/artifacts record the actual host, architecture, Node version, results, and skips. Runner coverage does not certify every OS version, architecture, terminal, or service host.

Before claiming macOS support, require every dedicated architecture/version job to pass on the intended revision, retain run/artifact links, remove `continue-on-error`, add macOS to the required gate, and update the consumer platform section. A green overall workflow alone does not prove exploratory success.

## Releases

New releases publish to npm only. Obtain explicit user authorization before publishing a GitHub release or package.

1. Update `package.json` and both root version entries in `package-lock.json`.
2. Run `npm run check` and `npm run test:consumer`.
3. Check the intended revision's complete Linux/Windows matrix, including native console and forced-termination results.
4. Tag the checked commit `v<version>` and publish its GitHub release when authorized.

`.github/workflows/npmpublish.yml` validates tag/manifest consistency, builds a tarball, and validates that exact archive before npm publication or stable Pages deployment. Failed, skipped, or cancelled required validation blocks both. Stable releases use `latest`; suffixed versions must be GitHub prereleases and use `next`. Build metadata is unsupported; promotion needs a new stable version. Only stable releases deploy Pages.

Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for repository `hypercliq/shutdown-cleanup`, workflow `npmpublish.yml`, no environment, and direct `npm publish` allowed. Publication uses a GitHub-hosted runner, Node.js 24, npm >=11.5.1, and OIDC without an npm token.

### Recovery

Use **Re-run failed jobs** to reuse the validated archive (retained 30 days); if expired, rebuild the original tagged commit. An already-published version with matching integrity is skipped; different contents or unavailable registry metadata stop publication. Never overwrite a version or move its tag: changed contents require a new version.

Recovery leaves existing dist-tags unchanged and refuses to move `latest`/`next` backwards. Repair missing tags separately after inspecting registry state. Historical runs retain old workflows: do not rerun retired GitHub Packages publication jobs or redeploy older Pages docs.

## Documentation and Pages

README provides installation and the runnable example; `DEVGUIDE.md` owns consumer behavior, API, and migrations. This guide owns development and release procedures; `AGENTS.md` contains short agent instructions.

Pages builds only the allowlisted README (as `index.md`), consumer guide, license, logo, and Jekyll configuration. Keep the staging list in `npmpublish.yml` explicit; repository scripts, tools, and maintainer/agent guides must not enter the site. For documentation changes, build the staged source locally with Jekyll, inspect its generated files and internal links, and do not deploy as part of validation.
