import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { parse } from 'yaml'
import { planValidation } from '../scripts/ci-validation.js'

const repository = 'hypercliq/shutdown-cleanup'
const before = '1'.repeat(40)
const head = '2'.repeat(40)
const after = '3'.repeat(40)
const tested = '4'.repeat(40)
const tree = '5'.repeat(40)
const platformWorkflow = parse(
  readFileSync(
    new URL('../.github/workflows/platform-validation.yml', import.meta.url),
    'utf8',
  ),
)
const matrix = platformWorkflow.jobs['platform-checks'].strategy.matrix
const fixture = () => ({
  context: {
    eventName: 'push',
    repository,
    event: { ref: 'refs/heads/main', before, after },
  },
  pulls: [
    {
      number: 1670,
      merged_at: '2026-11-02T14:00:00Z',
      merge_commit_sha: after,
      base: { ref: 'main', repo: { full_name: repository } },
      head: { sha: head },
    },
  ],
  workflow: { id: 42 },
  pushed: { tree: { sha: tree } },
  tested: {
    tree: { sha: tree },
    parents: [{ sha: before }, { sha: head }],
  },
  runs: [
    {
      id: 77,
      run_attempt: 1,
      event: 'pull_request',
      status: 'completed',
      conclusion: 'success',
      workflow_id: 42,
      path: '.github/workflows/node.js.yml',
      head_sha: head,
      repository: { full_name: repository },
      pull_requests: [],
      display_title: `Node.js CI / pull_request / ${tested} / PR 1670`,
    },
  ],
  jobs: [
    'toolchain / toolchain',
    'platforms / Linux, Windows and macOS support gate',
    ...matrix.runner.flatMap((runner) =>
      matrix.node.map((node) => `platforms / ${runner.label} / Node ${node}`),
    ),
  ].map((name) => ({ name, status: 'completed', conclusion: 'success' })),
})

const api = (data) => async (endpoint) => {
  const root = `/repos/${repository}`
  switch (endpoint) {
    case `${root}/commits/${after}/pulls?per_page=100`: {
      return data.pulls
    }
    case `${root}/actions/workflows/node.js.yml`: {
      return data.workflow
    }
    case `${root}/git/commits/${after}`: {
      return data.pushed
    }
    case `${root}/actions/workflows/node.js.yml/runs?event=pull_request&head_sha=${head}&status=success&per_page=100`: {
      return { workflow_runs: data.runs }
    }
    case `${root}/git/commits/${tested}`: {
      return data.tested
    }
    case `${root}/actions/runs/77/attempts/1/jobs?per_page=100`: {
      return { jobs: data.jobs, total_count: data.jobs.length }
    }
    default: {
      assert.fail(`Unexpected API endpoint: ${endpoint}`)
    }
  }
}

test('reuses the validated merge tree even when the final commit SHA differs', async () => {
  const data = fixture()
  assert.strictEqual(await planValidation(data.context, api(data)), false)
})

test('PR, merge queue and manual runs always validate without querying GitHub', async () => {
  for (const eventName of [
    'pull_request',
    'merge_group',
    'workflow_dispatch',
  ]) {
    const data = fixture()
    data.context.eventName = eventName
    assert.strictEqual(
      await planValidation(data.context, () =>
        assert.fail('Unexpected API call'),
      ),
      true,
    )
  }
})

for (const [name, change] of [
  ['direct push', (data) => (data.pulls = [])],
  ['unmerged PR', (data) => (data.pulls[0].merged_at = undefined)],
  ['different merge commit', (data) => (data.pulls[0].merge_commit_sha = head)],
  ['different target branch', (data) => (data.pulls[0].base.ref = 'other')],
  [
    'different repository',
    (data) => (data.pulls[0].base.repo.full_name = 'other/repo'),
  ],
  [
    'ambiguous PR association',
    (data) => {
      data.pulls.push(data.pulls[0])
    },
  ],
  ['no successful PR run', (data) => (data.runs = [])],
  ['different workflow', (data) => (data.runs[0].workflow_id = 99)],
  ['different PR head', (data) => (data.runs[0].head_sha = before)],
  [
    'different recorded PR',
    (data) =>
      (data.runs[0].display_title = `Node.js CI / pull_request / ${tested} / PR 999`),
  ],
  [
    'old run without tested SHA',
    (data) => (data.runs[0].display_title = 'Some PR title'),
  ],
  ['different tested base', (data) => (data.tested.parents[0].sha = head)],
  ['different tested head', (data) => (data.tested.parents[1].sha = before)],
  ['different merged content', (data) => (data.pushed.tree.sha = head)],
  ['forced push', (data) => (data.context.event.forced = true)],
]) {
  test(`runs full validation for ${name}`, async () => {
    const data = fixture()
    change(data)
    assert.strictEqual(await planValidation(data.context, api(data)), true)
  })
}

test('a successful overall run cannot hide missing, skipped or failed required jobs', async () => {
  for (const job of fixture().jobs) {
    for (const conclusion of ['skipped', 'cancelled', 'failure', undefined]) {
      const data = fixture()
      data.jobs.find((entry) => entry.name === job.name).conclusion = conclusion
      assert.strictEqual(
        await planValidation(data.context, api(data)),
        true,
        `${job.name}: ${conclusion}`,
      )
    }
    for (const duplicate of [false, true]) {
      const data = fixture()
      data.jobs = data.jobs.filter((entry) => entry.name !== job.name)
      if (duplicate) data.jobs.push(job, job)
      assert.strictEqual(await planValidation(data.context, api(data)), true)
    }
  }
})

test('API errors and incomplete responses always require full validation', async () => {
  const data = fixture()
  const endpoints = []
  await planValidation(data.context, async (endpoint) => {
    endpoints.push(endpoint)
    return api(data)(endpoint)
  })
  for (const failedEndpoint of endpoints) {
    for (const missing of [false, true]) {
      assert.strictEqual(
        await planValidation(data.context, async (endpoint) => {
          if (endpoint !== failedEndpoint) return api(data)(endpoint)
          if (missing) return {}
          throw new Error('Unavailable')
        }),
        true,
      )
    }
  }
})
