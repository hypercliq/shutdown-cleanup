# Contributing and maintaining

## Setup and checks

Development requires **Node.js 22.22.1 on 22.x or 24+**; `.nvmrc` selects 22.22.1. Node.js 23 is not supported by the toolchain. Keep the consumer minimum in `engines.node` independent of development tools.

```sh
nvm install
nvm use
npm ci --engine-strict
npm test          # Quick declaration and runtime/native checks
npm run check    # Complete pre-PR gate, including installed-package validation
```

`npm run check -- /path/to/package.tgz` validates an existing archive. `npm run test:package -- --runtime-only /path/to/package.tgz` runs full installed runtime/native tests without development dependencies. After development setup, omit the archive to pack once.

## Changes and fixtures

Keep `index.js`, `index.d.ts`, package exports, and `engines.node` aligned. Test through the packed consumer. Breaking API/runtime changes require a major release and [migration notes](DEVGUIDE.md#compatibility-and-migration).

Runtime/signal tests must use child processes; use `tests/subprocess-helper.js` for bounded execution and `tests/test-script.js` for scenarios. Strict NodeNext declaration fixtures live in `tests/types.ts`; reusable package fixtures belong in `scripts/`. Do not commit generated archives or coverage.

Test native OS delivery with `tests/signal-fixture.js`, never substitute `process.emit`. Windows tests require PowerShell and genuine console creation; native failures must fail the test.

## Platform validation

Require packed-package validation on Linux x64, Windows x64, macOS ARM64, and macOS Intel x64 with Node 22.0.0, current 22.x, 24.x, and 26.x. Review native signal, console, and forced-termination results for every target. Use **Node.js CI → Run workflow** for manual validation. See the [consumer limitations](DEVGUIDE.md#platforms-and-limitations) when testing application environments.

## Releases

New releases publish to npm only. Obtain explicit user authorization before publishing a GitHub release or package.

1. Update `package.json` and both root versions in `package-lock.json`; run `npm run check`.
2. Require the intended revision's complete [platform validation](#platform-validation).
3. When authorized, tag that commit `v<version>` and publish its GitHub release; mark suffixed versions as prereleases.

Require successful release metadata, development, installed-package, and platform checks against the same archive and SHA-512 checksum before npm publication. Failed, skipped, or cancelled required validation blocks publication. Stable releases use `latest`; prereleases use `next`. Build metadata is unsupported; promotion needs a new stable version.

Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for repository owner `hypercliq`, repository `shutdown-cleanup`, workflow `npmpublish.yml`, and no environment. Allow direct `npm publish`. Use a GitHub-hosted runner, Node.js 24, npm >=11.5.1, and OIDC without an npm token.

### Recovery

Use **Re-run failed jobs** to reuse the validated archive and checksum (retained 30 days); if expired, rerun all jobs on the original tagged commit. An already-published version must have matching integrity; different contents or unavailable registry metadata stop publication. Never overwrite a version or move its tag: changed contents require a new version.

Inspect registry state before separately repairing missing dist-tags. Recovery preserves existing tags and refuses to move `latest`/`next` backwards. Do not rerun retired GitHub Packages publication jobs or redeploy older Pages docs.

## Documentation and Pages

Keep installation and the runnable example in [README.md](README.md), and consumer behavior, API, limitations, and migrations in [DEVGUIDE.md](DEVGUIDE.md).

For documentation changes, build the staged consumer source locally with Jekyll and inspect generated files and internal links without deploying. Keep the staging allowlist in `npmpublish.yml` limited to README (as `index.md`), DEVGUIDE, license, logo, and Jekyll configuration. Pages requires successful npm publication and confirmation that the release is the latest published, including prereleases; if that evidence is unavailable, do not deploy.
