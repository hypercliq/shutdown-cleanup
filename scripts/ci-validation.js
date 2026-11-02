import { appendFileSync, readFileSync } from 'node:fs'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

const workflowPath = '.github/workflows/node.js.yml'
const requiredJobs = [
  'toolchain / toolchain',
  'platforms / Linux, Windows and macOS support gate',
  ...[
    'ubuntu-latest',
    'windows-latest',
    'macos-latest',
    'macos-26-intel',
  ].flatMap((runner) =>
    ['22.0.0', '22.x', '24.x', '26.x'].map(
      (node) => `platforms / ${runner} / Node ${node}`,
    ),
  ),
]

// Missing, expired or ambiguous evidence means validate again. PR titles and
// commit messages are deliberately not evidence of a validated merge.
export const canReuseValidation = async (
  { eventName, event, repository },
  get,
) => {
  if (
    eventName !== 'push' ||
    event.ref !== 'refs/heads/main' ||
    event.created ||
    event.deleted ||
    event.forced ||
    !/^[\da-f]{40}$/.test(event.before) ||
    /^0+$/.test(event.before)
  )
    return false

  const root = `/repos/${repository}`
  const pulls = await get(`${root}/commits/${event.after}/pulls?per_page=100`)
  if (pulls.length >= 100) return false
  const merged = pulls.filter(
    (pr) =>
      pr.merged_at &&
      pr.merge_commit_sha === event.after &&
      pr.base.ref === 'main' &&
      pr.base.repo.full_name === repository,
  )
  if (merged.length !== 1) return false
  const [pr] = merged
  const workflow = await get(`${root}/actions/workflows/node.js.yml`)
  const pushed = await get(`${root}/git/commits/${event.after}`)
  const { workflow_runs: runs } = await get(
    `${root}/actions/workflows/node.js.yml/runs?event=pull_request&head_sha=${pr.head.sha}&status=success&per_page=100`,
  )
  for (const run of runs) {
    if (
      run.event !== 'pull_request' ||
      run.status !== 'completed' ||
      run.conclusion !== 'success' ||
      run.workflow_id !== workflow.id ||
      run.path !== workflowPath ||
      run.head_sha !== pr.head.sha ||
      run.repository.full_name !== repository
    )
      continue

    // run-name records github.sha: the actual synthetic PR merge commit checked
    // out by CI, rather than the PR head SHA reported by the workflow-runs API.
    // GitHub can clear run.pull_requests after merging, so record the PR number
    // here too rather than relying on that mutable association.
    const evidence =
      /^Node\.js CI \/ pull_request \/ ([\da-f]{40}) \/ PR (\d+)$/.exec(
        run.display_title,
      )
    if (!evidence || Number(evidence[2]) !== pr.number) continue
    const testedSha = evidence[1]
    const tested = await get(`${root}/git/commits/${testedSha}`)
    if (
      tested.parents.length !== 2 ||
      tested.parents[0].sha !== event.before ||
      tested.parents[1].sha !== pr.head.sha ||
      tested.tree.sha !== pushed.tree.sha
    )
      continue

    const { jobs, total_count: totalCount } = await get(
      `${root}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs?per_page=100`,
    )
    if (jobs.length !== totalCount) continue
    if (
      requiredJobs.every((name) => {
        const matches = jobs.filter((job) => job.name === name)
        return (
          matches.length === 1 &&
          matches[0].status === 'completed' &&
          matches[0].conclusion === 'success'
        )
      })
    )
      return true
  }
  return false
}

export const planValidation = async (context, get) => {
  try {
    return !(await canReuseValidation(context, get))
  } catch {
    // API failures or incomplete evidence must cost a CI run, never coverage.
    return true
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
  const run = await planValidation(
    {
      eventName: process.env.GITHUB_EVENT_NAME,
      event,
      repository: process.env.GITHUB_REPOSITORY,
    },
    async (endpoint) => {
      const response = await fetch(`${process.env.GITHUB_API_URL}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${process.env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
        },
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`GitHub API ${response.status}`)
      return response.json()
    },
  )
  appendFileSync(process.env.GITHUB_OUTPUT, `run=${run}\n`)
  console.log(
    run
      ? 'Full validation required: no equivalent successful PR validation proved.'
      : 'Reusing successful PR validation of the same content and main base.',
  )
}
