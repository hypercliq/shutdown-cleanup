import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { test } from 'node:test'
import { parse } from 'yaml'

const workflow = (name) =>
  parse(
    readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      'utf8',
    ),
  )
const ci = workflow('node.js.yml')
const release = workflow('npmpublish.yml')
const platforms = workflow('platform-validation.yml')
const packageValidation = workflow('package-validation.yml')
const action = (job, name) =>
  job.steps.find((step) => step.uses?.startsWith(`${name}@`))

test('publication requires development checks and the Linux/Windows support gate', () => {
  assert.deepEqual(release.jobs['publish-npm'].needs, [
    'build',
    'validate-platforms',
  ])
  assert.deepEqual(release.jobs['publish-pages'].needs, [
    'build',
    'validate-platforms',
    'publish-npm',
  ])
  for (const name of [
    'build',
    'validate-platforms',
    'publish-npm',
    'publish-pages',
  ]) {
    assert.equal(
      release.jobs[name].if,
      undefined,
      `${name} must require success`,
    )
    assert.equal(release.jobs[name]['continue-on-error'], undefined)
  }
  assert.equal(release.jobs.build.with.release, true)
  assert.equal(release.jobs['validate-platforms'].needs, 'build')
  const gate = platforms.jobs['support-gate']
  assert.equal(gate.needs, 'linux-windows')
  assert.equal(gate.if, 'always()')
  assert.equal(gate['continue-on-error'], undefined)
  assert.equal(platforms.jobs['linux-windows']['continue-on-error'], undefined)
  assert.equal(gate.steps[0].env.RESULT, '${{ needs.linux-windows.result }}')
})

test(
  'the actual support gate rejects failure, cancellation and skipped validation',
  { skip: process.platform === 'win32' && 'The gate runs on Ubuntu with bash' },
  () => {
    for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const child = spawnSync(
        'bash',
        ['-c', platforms.jobs['support-gate'].steps[0].run],
        { env: { ...process.env, RESULT: result }, timeout: 5000 },
      )
      assert.ifError(child.error)
      assert.equal(child.status === 0, result === 'success', result)
    }
  },
)

test('all sixteen consumer combinations survive with macOS still exploratory', () => {
  const required = platforms.jobs['linux-windows']
  const macos = platforms.jobs['macos-validation']
  const versions = ['22.0.0', '22.x', '24.x', '26.x']
  assert.deepEqual(required.strategy.matrix, {
    os: ['ubuntu-latest', 'windows-latest'],
    node: versions,
  })
  assert.deepEqual(macos.strategy.matrix, {
    runner: [
      { label: 'macos-latest', architecture: 'arm64' },
      { label: 'macos-26-intel', architecture: 'x64' },
    ],
    node: versions,
  })
  assert.equal(macos['continue-on-error'], true)
  for (const job of [required, macos]) {
    assert.equal(job.strategy['fail-fast'], false)
    assert.ok(
      job.steps.some((step) => step.run?.includes('npm run test:consumer')),
    )
    assert.ok(job.steps.some((step) => step.run?.includes('set -o pipefail')))
    assert.equal(action(job, 'actions/upload-artifact').if, 'always()')
  }
  assert.ok(macos.steps.some((step) => step.run?.includes('process.arch')))
})

test('one archive feeds package resolution, every platform and publication', () => {
  assert.equal(ci.jobs.toolchain.uses, release.jobs.build.uses)
  assert.equal(ci.jobs.platforms.needs, 'toolchain')
  assert.equal(
    ci.jobs.platforms.with['artifact-name'],
    '${{ needs.toolchain.outputs.artifact-name }}',
  )
  assert.equal(
    release.jobs['validate-platforms'].with['artifact-name'],
    '${{ needs.build.outputs.artifact-name }}',
  )
  assert.equal(
    action(release.jobs['publish-npm'], 'actions/download-artifact').with.name,
    '${{ needs.build.outputs.artifact-name }}',
  )
  assert.equal(
    platforms.on.workflow_call.inputs['artifact-name'].required,
    true,
  )
  const jobs = [
    ...Object.values(ci.jobs),
    ...Object.values(release.jobs),
    ...Object.values(platforms.jobs),
    ...Object.values(packageValidation.jobs),
  ]
  const commands = jobs
    .flatMap((job) => job.steps ?? [])
    .map((step) => step.run ?? '')
  assert.equal(
    commands.filter((command) => command.includes('npm pack')).length,
    1,
  )
  assert.equal(
    commands.filter((command) => command === 'npm run check:source').length,
    1,
  )
  assert.ok(
    commands.some(
      (command) =>
        command.includes('test:package') && command.includes('--skip-runtime'),
    ),
  )
  const toolchain = packageValidation.jobs.toolchain
  assert.equal(toolchain.strategy, undefined)
  assert.equal(
    action(toolchain, 'actions/setup-node').with['node-version-file'],
    '.nvmrc',
  )
  const upload = action(toolchain, 'actions/upload-artifact')
  assert.ok(upload.with.path.includes('package.tgz.sha512'))
  for (const name of ['linux-windows', 'macos-validation']) {
    const job = platforms.jobs[name]
    assert.equal(
      action(job, 'actions/download-artifact').with.name,
      '${{ inputs.artifact-name }}',
    )
    assert.ok(
      job.steps.some((step) => step.run?.includes('scripts/archive.js verify')),
    )
  }
  assert.ok(
    release.jobs['publish-npm'].steps.some(
      (step) =>
        step.run?.includes('scripts/release.js publish') &&
        step.run.includes('package.tgz'),
    ),
  )
})

test('PR cancellation cannot cancel publication and Pages always checks freshness', () => {
  assert.equal(
    ci.concurrency['cancel-in-progress'],
    "${{ github.event_name == 'pull_request' }}",
  )
  assert.notEqual(ci.concurrency.group, release.concurrency.group)
  assert.equal(release.concurrency['cancel-in-progress'], false)
  const pages = release.jobs['publish-pages']
  assert.equal(pages.if, undefined)
  const freshness = pages.steps.find((step) => step.id === 'freshness')
  assert.equal(freshness.run, 'node scripts/pages-release.js')
  const deploymentSteps = pages.steps.slice(pages.steps.indexOf(freshness) + 1)
  for (const step of deploymentSteps) {
    assert.equal(step.if, "steps.freshness.outputs.deploy == 'true'")
  }
  assert.equal(
    action(pages, 'actions/upload-pages-artifact').with.name,
    action(pages, 'actions/deploy-pages').with.artifact_name,
  )
})
