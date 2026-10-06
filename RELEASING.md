# Releasing

New releases publish to npm only. Existing GitHub Packages versions remain available; `8.0.3` is the final mirrored release.

## Publish

1. Update `package.json` and both root version entries in `package-lock.json`.
2. Run `npm run check` and `npm run test:consumer`.
3. Require a successful Linux/Windows platform validation matrix on the intended revision: Node 22.0.0, current 22.x, 24.x and 26.x. Inspect native Windows console and forced-termination results, not just portable-event results. macOS remains a candidate until all eight dedicated ARM64/Intel x64 jobs pass and the [support policy](SUPPORT.md) is promoted.
4. Tag the checked commit `v<version>` and publish its GitHub release only with explicit user authorization.

The workflow validates tag and manifest consistency before publishing. After building, it validates the exact release tarball on the full Linux/Windows matrix; both npm publication and Pages deployment require that gate. Exploratory macOS failures are retained but do not block release while macOS is unclaimed. Stable versions use `latest`; versions with a prerelease suffix must be marked as GitHub prereleases and use `next`. Build metadata is not supported. Promotion requires a new stable version. Only stable releases deploy Pages.

## npm configuration

Configure [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/) for `hypercliq/shutdown-cleanup`, workflow `npmpublish.yml`, no environment, with direct `npm publish` allowed. Publication uses a GitHub-hosted runner, Node.js 24, npm >=11.5.1, and OIDC; no npm token is required.

## Recovery

- Use **Re-run failed jobs** to retry with the validated tarball, retained for 30 days. If it has expired, rebuild the original tagged commit.
- An already-published version with matching integrity is skipped. Different contents or unavailable registry metadata stop publication. Never overwrite a version or move its Git tag; publish a new version for changed contents.
- Recovery does not modify existing dist-tags and refuses to move `latest` or `next` backwards. Correct missing tags separately after checking the current registry state.
- Old runs retain their original workflows. Do not rerun historical GitHub Packages publication jobs or redeploy older Pages documentation.
