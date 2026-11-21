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

Both package checks can use an existing archive. `npm run check -- /path/to/package.tgz` runs the full development checks against it. `npm run test:package -- --runtime-only /path/to/package.tgz` runs the installed runtime and native tests without development dependencies. From a development checkout, either command can build the archive when you omit the path.

## Changes and fixtures

Keep `index.js`, `index.d.ts`, package exports, and `engines.node` aligned. Test through the packed consumer. Breaking API/runtime changes require a major release and [migration notes](DEVGUIDE.md#compatibility-and-migration).

Runtime/signal tests must use child processes; use `tests/subprocess-helper.js` for bounded execution and `tests/test-script.js` for scenarios. Strict NodeNext declaration fixtures live in `tests/types.ts`; reusable package fixtures belong in `scripts/`. Do not commit generated archives or coverage.

Test native OS delivery with `tests/signal-fixture.js`, never substitute `process.emit`. Windows tests require PowerShell and genuine console creation; native failures must fail the test.

## Platform validation

Pull requests, merge-queue entries, and manual runs go straight to full validation. To start a manual run, choose **Node.js CI → Run workflow**.

Only pushes to `main` run the read-only planner. A push can reuse PR validation when the recorded PR merge commit has the previous `main` and the PR head as its parents, its tree matches the pushed content, and the toolchain, all sixteen platform jobs, and the support gate succeeded. Direct pushes, changed bases, missing evidence, and planner failures trigger full validation.

`main` requires PRs and up-to-date CodeQL, toolchain and platform-gate checks.
Repository administrators (including organization owners) may bypass these
requirements for exceptional direct pushes, which still trigger CI. Other roles
cannot bypass them. Force pushes and branch deletion are prohibited for everyone.

Require packed-package validation on Linux x64, Windows x64, macOS ARM64, and macOS Intel x64 with Node 22.0.0, current 22.x, 24.x, and 26.x. Review native signal, console, and forced-termination results for every target. See the [consumer limitations](DEVGUIDE.md#platforms-and-limitations) when testing application environments.

## Releases

New releases publish to npm only. Obtain explicit user authorization before publishing a GitHub release or package.

1. Update `package.json` and both root versions in `package-lock.json`; run `npm run check`.
2. Require the intended revision's complete [platform validation](#platform-validation).
3. When authorized, tag that commit `v<version>` and publish its GitHub release; mark suffixed versions as prereleases.

The release workflow runs its own validation, independently of the push planner. Publication requires successful release metadata, development, installed-package, and platform checks. The workflow verifies the same archive against its SHA-512 checksum before publishing. Failed, skipped, or cancelled required validation blocks publication. Stable releases use `latest`, and prereleases use `next`. Promotion requires a new stable version. The release workflow rejects versions with build metadata.

Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for repository owner `msanguineti`, repository `phased-shutdown`, workflow `npmpublish.yml`, and no environment. Allow direct `npm publish`. Use a GitHub-hosted runner, Node.js 24, npm >=11.5.1, and OIDC without an npm token.

### Recovery

After a successful build, use **Re-run failed jobs** to reuse its validated archive and checksum, retained for 30 days. If the archive is unavailable and GitHub still offers a rerun, use **Re-run all jobs** on the original release run to rebuild from the original tagged commit. If the run is outside GitHub’s 30-day rerun window, stop and confirm a recovery path before attempting publication. [GitHub’s rerun limits](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)

An already-published version must have matching integrity. Different contents or unavailable registry metadata stop publication. Changed contents require a new version and tag.

Inspect registry state before separately repairing missing dist-tags. Recovery preserves existing tags and refuses to move `latest`/`next` backwards. Do not rerun retired GitHub Packages publication jobs or redeploy older Pages docs.

## Documentation and Pages

Keep installation and the runnable example in [README.md](README.md), and consumer behavior, API, limitations, and migrations in [DEVGUIDE.md](DEVGUIDE.md).

With the `github-pages` gem installed, run these commands from the repository root to build the consumer docs locally. They stage the same files as `npmpublish.yml`. Inspect `_site/index.html` and `_site/DEVGUIDE.html` and check their internal links.

```sh
mkdir -p .pages-source
cp README.md .pages-source/index.md
cp DEVGUIDE.md LICENSE logo-io.png _config.yml .pages-source/
(
  cd .pages-source
  PAGES_REPO_NWO=msanguineti/phased-shutdown \
    ruby -r github-pages -S jekyll build --destination ../_site
)
```

The workflow deploys Pages after npm publication succeeds or the published package passes its integrity check. The triggering release must also be the newest by GitHub publication time, including prereleases. If the workflow cannot verify this, it stops deployment.
