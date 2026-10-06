import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
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

test('publication requires development checks and the Linux/Windows/macOS support gate', () => {
  assert.ok([release.jobs['publish-npm'].needs].flat().includes('build'))
  assert.ok(
    [release.jobs['publish-npm'].needs].flat().includes('validate-platforms'),
  )
  assert.ok(
    [release.jobs['publish-pages'].needs].flat().includes('publish-npm'),
  )
  for (const name of [
    'build',
    'validate-platforms',
    'publish-npm',
    'publish-pages',
  ]) {
    assert.equal(
      [undefined, 'success()', '${{ success() }}'].includes(
        release.jobs[name].if,
      ),
      true,
      `${name} must require success`,
    )
    assert.ok(
      [undefined, false].includes(release.jobs[name]['continue-on-error']),
    )
  }
  assert.equal(release.jobs.build.with.release, true)
  assert.equal(release.jobs['validate-platforms'].needs, 'build')
  const gate = platforms.jobs['support-gate']
  assert.equal(gate.needs, 'platform-checks')
  assert.equal(gate.if, 'always()')
  assert.ok([undefined, false].includes(gate['continue-on-error']))
  for (const job of [
    packageValidation.jobs.toolchain,
    ...Object.values(platforms.jobs),
  ]) {
    assert.ok([undefined, false].includes(job['continue-on-error']))
    for (const step of job.steps) {
      assert.ok([undefined, false].includes(step['continue-on-error']))
    }
  }
})

test(
  'the actual support gate rejects failure, cancellation and skipped validation',
  { skip: process.platform === 'win32' && 'The gate runs on Ubuntu with bash' },
  () => {
    const gate = platforms.jobs['support-gate'].steps.find((step) =>
      Object.values(step.env ?? {}).includes(
        '${{ needs.platform-checks.result }}',
      ),
    )
    const resultVariable = Object.keys(gate.env).find(
      (name) => gate.env[name] === '${{ needs.platform-checks.result }}',
    )
    for (const result of ['success', 'failure', 'cancelled', 'skipped', '']) {
      const child = spawnSync('bash', ['-c', gate.run], {
        env: { ...process.env, [resultVariable]: result },
        timeout: 5000,
      })
      assert.ifError(child.error)
      assert.equal(child.status === 0, result === 'success', result)
    }
  },
)

test('one required matrix covers all sixteen consumer combinations and architectures', () => {
  const job = platforms.jobs['platform-checks']
  assert.deepEqual(
    job.strategy.matrix.runner.toSorted((left, right) =>
      left.label.localeCompare(right.label),
    ),
    [
      { label: 'ubuntu-latest', architecture: 'x64' },
      { label: 'windows-latest', architecture: 'x64' },
      { label: 'macos-latest', architecture: 'arm64' },
      { label: 'macos-26-intel', architecture: 'x64' },
    ].toSorted((left, right) => left.label.localeCompare(right.label)),
  )
  assert.deepEqual(
    job.strategy.matrix.node.toSorted((left, right) =>
      left.localeCompare(right),
    ),
    ['22.0.0', '22.x', '24.x', '26.x'],
  )
  assert.equal(job['runs-on'], '${{ matrix.runner.label }}')
  assert.ok([undefined, 'success()', '${{ success() }}'].includes(job.if))
  assert.equal(job.strategy['fail-fast'], false)
})

test(
  'native validation rejects the wrong architecture and failed package tests',
  { skip: process.platform === 'win32' && 'The workflow uses bash' },
  () => {
    const validation = platforms.jobs['platform-checks'].steps.find((step) =>
      Object.values(step.env ?? {}).includes(
        '${{ matrix.runner.architecture }}',
      ),
    )
    const architectureVariable = Object.keys(validation.env).find(
      (name) => validation.env[name] === '${{ matrix.runner.architecture }}',
    )
    const directory = mkdtempSync(path.join(tmpdir(), 'workflow-validation-'))
    try {
      for (const [architecture, packageResult] of [
        [process.arch, '0'],
        ['wrong-architecture', '0'],
        [process.arch, '1'],
      ]) {
        const child = spawnSync(
          'bash',
          [
            '-e',
            '-c',
            `npm() { return "$PACKAGE_RESULT"; }\n${validation.run}`,
          ],
          {
            cwd: directory,
            env: {
              ...process.env,
              [architectureVariable]: architecture,
              PACKAGE_RESULT: packageResult,
            },
            timeout: 5000,
          },
        )
        assert.ifError(child.error)
        assert.equal(
          child.status === 0,
          architecture === process.arch && packageResult === '0',
          `${architecture}, package exit ${packageResult}`,
        )
      }
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  },
)

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
  const toolchain = packageValidation.jobs.toolchain
  const upload = action(toolchain, 'actions/upload-artifact')
  assert.equal(
    packageValidation.on.workflow_call.outputs['artifact-name'].value,
    '${{ jobs.toolchain.outputs.artifact-name }}',
  )
  assert.equal(upload.with.name, toolchain.outputs['artifact-name'])
  const archive = upload.with.path
    .split('\n')
    .find((file) => file.endsWith('.tgz'))
  assert.ok(archive)
  assert.ok(upload.with.path.split('\n').includes(`${archive}.sha512`))
  const archiveName = path.basename(archive)
  const commands = toolchain.steps.map((step) => step.run ?? '')
  assert.equal(
    commands.filter((command) => /\bnpm\s+pack\b/.test(command)).length,
    1,
  )
  assert.ok(
    commands.some(
      (command) =>
        /\bnpm\s+run\s+check\b/.test(command) && command.includes(archiveName),
    ),
  )
  const job = platforms.jobs['platform-checks']
  assert.equal(
    action(job, 'actions/download-artifact').with.name,
    '${{ inputs.artifact-name }}',
  )
  assert.ok(
    job.steps.some(
      (step) =>
        step.run?.includes('scripts/archive.js verify') &&
        step.run.includes(archiveName),
    ),
  )
  assert.ok(
    job.steps.some(
      (step) =>
        /\bnpm\s+run\s+test:package\b/.test(step.run ?? '') &&
        step.run.includes(archiveName),
    ),
  )
  assert.ok(
    release.jobs['publish-npm'].steps.some(
      (step) =>
        step.run?.includes('scripts/release.js publish') &&
        step.run.includes(archiveName),
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
  const freshness = pages.steps.find((step) =>
    step.run?.includes('scripts/pages-release.js'),
  )
  assert.ok(freshness?.id)
  assert.equal(freshness.if, undefined)
  for (const name of [
    'actions/jekyll-build-pages',
    'actions/upload-pages-artifact',
    'actions/deploy-pages',
  ]) {
    const step = action(pages, name)
    assert.ok(pages.steps.indexOf(step) > pages.steps.indexOf(freshness))
    assert.equal(step.if, `steps.${freshness.id}.outputs.deploy == 'true'`)
  }
  assert.equal(
    action(pages, 'actions/upload-pages-artifact').with.name,
    action(pages, 'actions/deploy-pages').with.artifact_name,
  )
})
