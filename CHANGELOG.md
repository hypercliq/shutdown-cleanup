# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [5.0.0](https://github.com/hypercliq/shutdown-cleanup/compare/v4.1.2...v5.0.0) (2022-05-23)

### ⚠ BREAKING CHANGES

- **node:** nodejs version 12 and below will not be supported (and likely will not work)

### Features

- **node:** :fire: drop support for node <= 12 ([05ae897](https://github.com/hypercliq/shutdown-cleanup/commit/05ae897ce24ba12042a46b5f1c3863b89b0652ee))

### Fixes

- add @types/node to peer deps ([536ab2a](https://github.com/hypercliq/shutdown-cleanup/commit/536ab2a762f5c8d55ffdef39cbc479ed94f89c18))

### Chores

- **release:** 4.1.3 ([c17a8f6](https://github.com/hypercliq/shutdown-cleanup/commit/c17a8f6588e47cdac5401280daded03d0bce665d))

### [4.1.3](https://github.com/hypercliq/shutdown-cleanup/compare/v4.1.2...v4.1.3) (2022-03-28)

### Fixes

- add @types/node to peer deps ([536ab2a](https://github.com/hypercliq/shutdown-cleanup/commit/536ab2a762f5c8d55ffdef39cbc479ed94f89c18))

### [4.1.2](https://github.com/hypercliq/shutdown-cleanup/compare/v4.1.1...v4.1.2) (2022-03-28)

### Fixes

- :bug: types definition 'not a module' error ([25704c9](https://github.com/hypercliq/shutdown-cleanup/commit/25704c935244d55268723c1994c0dcb2e716ba72))

### [4.1.1](https://github.com/hypercliq/shutdown-cleanup/compare/v4.1.0...v4.1.1) (2021-11-26)

### Fixes

- **logger:** :bug: logger not printing debug messages ([aa35fed](https://github.com/hypercliq/shutdown-cleanup/commit/aa35feda9ee54ba7fe7fad82014f94a844d04afe))

## [4.1.0](https://github.com/hypercliq/shutdown-cleanup/compare/v4.0.2...v4.1.0) (2021-11-25)

### Features

- **node:** :wrench: support node 17 ([bd66ceb](https://github.com/hypercliq/shutdown-cleanup/commit/bd66ceb48100eb9ec9aae7721444cfa6f0003f83))

### Chores

- **github-action:** :fire: remove action ([fe6fbed](https://github.com/hypercliq/shutdown-cleanup/commit/fe6fbeddf59c85c0836b8d1a0067f223ff282738))

### Refactoring

- :recycle: code organisation ([3fe46de](https://github.com/hypercliq/shutdown-cleanup/commit/3fe46de753d7b5bc8a1fcbb53c8ae3d0614056db))

### Build

- **deps:** bump actions/checkout from 2.3.4 to 2.4.0 ([80ca76a](https://github.com/hypercliq/shutdown-cleanup/commit/80ca76a29419dfe5181afaa4e4e6e54beeab48f5))
- **deps:** bump actions/setup-node from 2.4.0 to 2.4.1 ([068c68c](https://github.com/hypercliq/shutdown-cleanup/commit/068c68c8cdf410804241ae7acd82366bb3e2f96b))
- **npm:** :arrow_up: upgrade deps ([ca0b929](https://github.com/hypercliq/shutdown-cleanup/commit/ca0b92952bbc4c08b4de3bbc5cba279ee8b126b6))

### [4.0.2](https://github.com/hypercliq/shutdown-cleanup/compare/v4.0.1...v4.0.2) (2021-09-16)

### Style

- format file ([efe8718](https://github.com/hypercliq/shutdown-cleanup/commit/efe87180402c6336c76222c5d6826038c463d2a1))

### Build

- **deps:** bump actions/setup-node from 2.1.5 to 2.2.0 ([be6ffc9](https://github.com/hypercliq/shutdown-cleanup/commit/be6ffc94745857d282a84e6f4c1157767683290a))
- **deps:** bump actions/setup-node from 2.2.0 to 2.4.0 ([342ce09](https://github.com/hypercliq/shutdown-cleanup/commit/342ce09878606cbc5db42d0e5c5f3c5fd22f2f4d))
- **deps:** bump ws from 7.4.5 to 7.4.6 ([bd9b7aa](https://github.com/hypercliq/shutdown-cleanup/commit/bd9b7aadcbfa4b3327dd8de8220db902fe57cab7))
- **npm:** :arrow_up: upgrade pkgs ([5a23f76](https://github.com/hypercliq/shutdown-cleanup/commit/5a23f7619090de118b4309fcbc7e5ad578772772))

### Fixes

- **npm:** :ambulance: packages vulnerabilities ([66c34fa](https://github.com/hypercliq/shutdown-cleanup/commit/66c34fa1ca5691905c416024579721c7774e8dff))

### [4.0.1](https://github.com/hypercliq/shutdown-cleanup/compare/v4.0.0...v4.0.1) (2021-05-18)

### Build

- **deps:** bump actions/checkout from 2 to 2.3.4 ([f3b0fd7](https://github.com/hypercliq/shutdown-cleanup/commit/f3b0fd7d22c1ae71a272fc12c86ecae13b02edc7))

- **npm:** :arrow_up: upgrade deps ([d7ab404](https://github.com/hypercliq/shutdown-cleanup/commit/d7ab404bed9f60ca614c5a3c4ad01b480895b7a3))
- **npm:** :wrench: explicit node support >=12 ([2ffa422](https://github.com/hypercliq/shutdown-cleanup/commit/2ffa4228f97825ffb75c9b73adad30187d55800d))

### Chores

- **changelog:** unhide sections ([0ebe641](https://github.com/hypercliq/shutdown-cleanup/commit/0ebe641a4190dc55d582dbe7e25e82531ade3d09))
- **npm:** :fire: remove 'prerelease' script ([ae3ce05](https://github.com/hypercliq/shutdown-cleanup/commit/ae3ce05b46980df9daff5423ca5645e41f3fb852))

## [4.0.0](https://github.com/hypercliq/shutdown-cleanup/compare/v3.2.1...v4.0.0) (2021-03-26)

### Tests

- :white_check_mark: update for latest commander version ([7ca5c61](https://github.com/hypercliq/shutdown-cleanup/commit/7ca5c6113e3e01b70810eb380dafdda382cf5d6b))

### CI/CD

- :boom: remove support for node<=10 ([2e4532c](https://github.com/hypercliq/shutdown-cleanup/commit/2e4532c41865d05463fdba5167c48a289c3b70a7))
- **dependabot:** :green_heart: remove dependabot automerge action ([2352ec7](https://github.com/hypercliq/shutdown-cleanup/commit/2352ec77725d8ae1089c971faa83e8f8aec5cd09))

### [3.2.1](https://github.com/hypercliq/shutdown-cleanup/compare/v3.2.0...v3.2.1) (2021-01-04)

### Misc

- :package: update eslint-config-prettier ([84c9e41](https://github.com/hypercliq/shutdown-cleanup/commit/84c9e41f8ecd8b89f0919001cae0ba54f463cf65))
- **deps:** bump actions/setup-node from v2.1.2 to v2.1.4 ([90e1711](https://github.com/hypercliq/shutdown-cleanup/commit/90e1711f1a337d311bbf8af3701d5a475ed01489))
- **deps:** bump ini from 1.3.5 to 1.3.8 ([309b987](https://github.com/hypercliq/shutdown-cleanup/commit/309b98752cb4b71fdbb8375120340c32342773d9))
- **deps:** bump node-notifier from 8.0.0 to 8.0.1 ([89657ab](https://github.com/hypercliq/shutdown-cleanup/commit/89657ab37382921e9b72d3d9a67d524ea12267a9))

## [3.2.0](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.13...v3.2.0) (2020-11-25)

### Features

- :sparkles: es module available via 'module' property in package.json ([8ad24c6](https://github.com/hypercliq/shutdown-cleanup/commit/8ad24c6805858f73eb1f447b77202b9071b34dd1))

### Documentation

- update badge ([59e461b](https://github.com/hypercliq/shutdown-cleanup/commit/59e461b7fc8af4f70054ff7e025be8e631b643a5))

### Refactoring

- :fire: remove debug dependency ([ff5719d](https://github.com/hypercliq/shutdown-cleanup/commit/ff5719d72aec8628a515fb74f6ecfc213677e498))

### CI/CD

- add node 15 to builds ([6a2b096](https://github.com/hypercliq/shutdown-cleanup/commit/6a2b09648dc53bd99a582f20de4bfc397862fd7c))
- change main branch to 'main' ([d99deff](https://github.com/hypercliq/shutdown-cleanup/commit/d99deff8a7bf25621e904a7f3a05f1f00a3dfdf4))

### Misc

- **release:** 3.1.15 ([80ae291](https://github.com/hypercliq/shutdown-cleanup/commit/80ae291dade93ed0c680522fe9539a644bdd5667))
- new logo ([64552aa](https://github.com/hypercliq/shutdown-cleanup/commit/64552aaf2fece046d854dff2fabb2ee4bd4af45c))

### [3.1.15](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.14...v3.1.15) (2020-11-14)

### Documentation

- :memo: add a couple of badges ([346f16b](https://github.com/hypercliq/shutdown-cleanup/commit/346f16b80fa529d19ae878bf5e8a7d2c4be1d5e8))

### [3.1.14](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.13...v3.1.14) (2020-11-14)

### Documentation

- update badge ([59e461b](https://github.com/hypercliq/shutdown-cleanup/commit/59e461b7fc8af4f70054ff7e025be8e631b643a5))

### Misc

- new logo ([64552aa](https://github.com/hypercliq/shutdown-cleanup/commit/64552aaf2fece046d854dff2fabb2ee4bd4af45c))

### Refactoring

- :fire: remove debug dependency ([ff5719d](https://github.com/hypercliq/shutdown-cleanup/commit/ff5719d72aec8628a515fb74f6ecfc213677e498))

### CI/CD

- add node 15 to builds ([6a2b096](https://github.com/hypercliq/shutdown-cleanup/commit/6a2b09648dc53bd99a582f20de4bfc397862fd7c))
- change main branch to 'main' ([d99deff](https://github.com/hypercliq/shutdown-cleanup/commit/d99deff8a7bf25621e904a7f3a05f1f00a3dfdf4))

### [3.1.13](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.12...v3.1.13) (2020-10-27)

### Bug Fixes

- return exitCode set by node or 1 if undefined ([985f131](https://github.com/hypercliq/shutdown-cleanup/commit/985f131c19693865d2e8c37158762958ab3fd3c5))
- use badgen NOT shields.io ([caa8a98](https://github.com/hypercliq/shutdown-cleanup/commit/caa8a984b7f8f69a3ce8e5e0270c6bb437adf464))

### Misc

- do not include in npm.package useless files ([2d226be](https://github.com/hypercliq/shutdown-cleanup/commit/2d226beee92d0bbae86c1fbb77a87cf095e2cf80))

### Tests

- report nodejs exit codes (error numbers) or 1 when undefined ([391a2ce](https://github.com/hypercliq/shutdown-cleanup/commit/391a2ceea5dcd8f42a15a61dc964d6cfe875205b))

### Documentation

- comments and updated README with new exit code section ([64e29bf](https://github.com/hypercliq/shutdown-cleanup/commit/64e29bf2d2c979496f4f0c35d610db8e5020a8b2))

### [3.1.12](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.11...v3.1.12) (2020-10-15)

### Misc

- **deps:** bump debug from 4.1.1 to 4.2.0 ([c879a37](https://github.com/hypercliq/shutdown-cleanup/commit/c879a371cb3aea691c0340a47abdca97bcaa153d))
- **deps:** update actions/setup-node requirement to v2.1.2 ([51df256](https://github.com/hypercliq/shutdown-cleanup/commit/51df256c50c14b791e98ca69aa8a29d6a29f816a))

### [3.1.11](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.10...v3.1.11) (2020-09-14)

### Misc

- fix npm scripts ([9bc8383](https://github.com/hypercliq/shutdown-cleanup/commit/9bc83839f886d7566b2ffa9bab79ea767ac6b0e7))
- update & audit packages ([f660fe1](https://github.com/hypercliq/shutdown-cleanup/commit/f660fe1657cea009d66d5a9073bcd3ea7429a051))
- update eslintrc ([4defc10](https://github.com/hypercliq/shutdown-cleanup/commit/4defc1075251fd7240fd67ae0cb8af101f4ca4e1))

### CI/CD

- add node 10.x to ci ([0bceaf3](https://github.com/hypercliq/shutdown-cleanup/commit/0bceaf32045b61ee2ed70ef69589d39b368af751))
- update github nodejs ci ([56873a0](https://github.com/hypercliq/shutdown-cleanup/commit/56873a05fca532a151bd7ee7af2bec47fcdbeb52))

### [3.1.10](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.9...v3.1.10) (2020-09-02)

### Misc

### Refactoring

- modular code ([87520fc](https://github.com/hypercliq/shutdown-cleanup/commit/87520fc59eaf507c36f016a5104850f5980d4645))

### Tests

- fix imports ([3e2b0f8](https://github.com/hypercliq/shutdown-cleanup/commit/3e2b0f884d1b83be4b6590da609845490a7db35f))

### [3.1.9](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.8...v3.1.9) (2020-09-02)

### CI/CD

- add node 14 ([f801c65](https://github.com/hypercliq/shutdown-cleanup/commit/f801c6555611aa9dcd1e798ce065ebe97db9d409))

### Misc

- add CI/CD section in CHANGELOG ([27dcba4](https://github.com/hypercliq/shutdown-cleanup/commit/27dcba475080bffce254a10eba7a35860eb20365))
- update & audit packages ([a51fa49](https://github.com/hypercliq/shutdown-cleanup/commit/a51fa49db6f6facd58fe4a9076675f25d9aea90d))

### [3.1.8](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.7...v3.1.8) (2020-08-03)

### Misc

- update & audit packages ([1a71e8f](https://github.com/hypercliq/shutdown-cleanup/commit/1a71e8fe449951a90e4a8eb8b483b5107ea1f012))

### [3.1.7](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.6...v3.1.7) (2020-06-24)

### Misc

- update packages ([0707983](https://github.com/hypercliq/shutdown-cleanup/commit/0707983a19443d7f0be75bcc1094d218c1f3f81a))

### [3.1.6](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.5...v3.1.6) (2020-06-19)

### Misc

### [3.1.5](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.4...v3.1.5) (2020-06-10)

### Misc

### [3.1.4](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.3...v3.1.4) (2020-05-10)

### Misc

- **deps:** [security] bump acorn from 6.4.0 to 6.4.1 ([4b7e080](https://github.com/hypercliq/shutdown-cleanup/commit/4b7e08024faaef5ccb6c6e3ac5997e7ffa1e45dd))

- **npm:** update & audit pkgs ([5314eb7](https://github.com/hypercliq/shutdown-cleanup/commit/5314eb7a87778834d011328834e65515d3550071))
- allow linting js files and typechecking .ts ([84e4837](https://github.com/hypercliq/shutdown-cleanup/commit/84e4837b4637f3f8dc7e394a4cfba30c2f7da90b))

- move badge from shields.io to badgen ([2f264b3](https://github.com/hypercliq/shutdown-cleanup/commit/2f264b3766b34a0ee41a2b2a122bc9b425b6730c))

### [3.1.3](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.2...v3.1.3) (2020-02-27)

### Misc

- richer changelogs ([#54](https://github.com/hypercliq/shutdown-cleanup/issues/54)) ([16923f7](https://github.com/hypercliq/shutdown-cleanup/commit/16923f73f006cdfcad8c9ed050d7bac4bfd65346))
- **tsc:** fix target ([#53](https://github.com/hypercliq/shutdown-cleanup/issues/53)) ([6e3cd4f](https://github.com/hypercliq/shutdown-cleanup/commit/6e3cd4f20053a70175e2c420c9b36adf1025b7e5))
- fix extension list ([#52](https://github.com/hypercliq/shutdown-cleanup/issues/52)) ([a7fe97e](https://github.com/hypercliq/shutdown-cleanup/commit/a7fe97eb9f3a4ef25eeef51c345e840a88e64e79))

### [3.1.2](https://github.com/hypercliq/shutdown-cleanup/compare/v3.1.2-0...v3.1.2) (2020-02-13)

### Bug Fixes

- lint errors ([184fcc8](https://github.com/hypercliq/shutdown-cleanup/commit/184fcc8a07aa02d8e6130ea681dc8882a91dea0c))

### 3.1.2-0 (2020-02-13)

- pre-release cleanups

## 3.1.1 (2020-01-31)

### Bug Fixes

- **deps:** update pkgs ([#35](https://github.com/hypercliq/shutdown-cleanup/issues/35)) ([e1ecb13](https://github.com/hypercliq/shutdown-cleanup/commit/e1ecb1380a7d72fe01b71b019c5a6f2267de9770))

## [3.1.0](https://github.com/hypercliq/shutdown-cleanup/compare/v3.0.1...v3.1.0) (2019-11-28)

### Features

- list signals currenlty listened to ([3161d60](https://github.com/hypercliq/shutdown-cleanup/commit/3161d60f45ae5de0dbc2e20740c9d9e8805b9e2b))

### Bug Fixes

- use types, add tests ([be81f30](https://github.com/hypercliq/shutdown-cleanup/commit/be81f30ed93016a67ca09a853f4817c6e4b4aae5))
- **package:** update lock and fix packages ([591e7a8](https://github.com/hypercliq/shutdown-cleanup/commit/591e7a8ecfc3219c6ee4f97656c06e182ab6c611))
- **package:** update packages ([c87777c](https://github.com/hypercliq/shutdown-cleanup/commit/c87777c95aca979759afa25bc18bb5a97bf316bd))

### [3.0.2](https://github.com/hypercliq/shutdown-cleanup/compare/v3.0.1...v3.0.2) (2019-11-19)

### Bug Fixes

- remove npmignore ([d09194e](https://github.com/hypercliq/shutdown-cleanup/commit/d09194efaffb26bd92069afd0f15134c333c6479))
- update packages ([da42dc8](https://github.com/hypercliq/shutdown-cleanup/commit/da42dc8e835536e74ddaaf496464a4bc688b7646))

### [3.0.1](https://github.com/hypercliq/shutdown-cleanup/compare/v3.0.0...v3.0.1) (2019-11-12)

### Bug Fixes

- latest changes from upstream ([adbd248](https://github.com/hypercliq/shutdown-cleanup/commit/adbd2483a1405b469074fd5300ca400d005c7b42))

### [2.0.1](https://github.com/hypercliq/shutdown-cleanup/compare/v2.0.0...v2.0.1) (2019-11-11)

### Bug Fixes

- better exit code ([34569e8](https://github.com/hypercliq/shutdown-cleanup/commit/34569e84c39166e3b63cd8532fac1af0d83d7297))
- export API types ([f462963](https://github.com/hypercliq/shutdown-cleanup/commit/f4629638fc8fff61fa886d8995399c66ac8a5b1a))

## 2.0.0 (2019-11-07)

### ⚠ BREAKING CHANGES

- TS builds will fail

### Features

- add proper TS types ([8a66466](https://github.com/hypercliq/shutdown-cleanup/commit/8a6646616c5c97e0004a5f842de11d2a57f30dbe))

### [1.0.1](https://github.com/hypercliq/shutdown-cleanup/compare/v1.0.0...v1.0.1) (2019-11-06)

### Bug Fixes

- documentation fixes ([6d8920d](https://github.com/hypercliq/shutdown-cleanup/commit/6d8920d9ca751570d4b232a45569a08499b8f820))

## [1.0.0](https://github.com/hypercliq/shutdown-cleanup/compare/v0.1.0...v1.0.0) (2019-11-06)

### Bug Fixes

- package name change ([4189794](https://github.com/hypercliq/shutdown-cleanup/commit/41897945ffddab142ece391b3153f2c03d928a41))

## 0.1.0 (2019-11-06)

### Features

- shutdown cleanup source ([c54bb1e](https://github.com/hypercliq/shutdown-cleanup/commit/c54bb1eb5bbbd058240c09862c3d76a0476d910e))

### Bug Fixes

- call process.exit after every handler ([d18e38d](https://github.com/hypercliq/shutdown-cleanup/commit/d18e38d5f3e7104302c5b6371936bc4518284c36))
- change class name ([0d9b493](https://github.com/hypercliq/shutdown-cleanup/commit/0d9b493f68ba3e7dd6533072170e5f0d6ae1dbca))
- lint-staged passing wrong files ([01aa922](https://github.com/hypercliq/shutdown-cleanup/commit/01aa9222c72b7911687db5a8872a4f6cfae88502))
- package name and repo ([8808a9b](https://github.com/hypercliq/shutdown-cleanup/commit/8808a9b18e9c75ec64da077ea053049c7f4f9632))
- wrong type passed to function ([977d9ff](https://github.com/hypercliq/shutdown-cleanup/commit/977d9fff88665ec97b211efa9cd088d43c49f87b))
