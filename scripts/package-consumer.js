import { execFileSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

export const projectDirectory = fileURLToPath(new URL('../', import.meta.url))

// npm run supplies the CLI path, so npm and every subprocess use this Node.
export const withInstalledPackage = (tarball, validate) => {
  const consumerDirectory = mkdtempSync(
    path.join(tmpdir(), 'shutdown-cleanup-consumer-'),
  )
  const npm = (arguments_, options = {}) =>
    execFileSync(process.execPath, [process.env.npm_execpath, ...arguments_], {
      cwd: consumerDirectory,
      stdio: 'inherit',
      timeout: 120_000,
      killSignal: 'SIGKILL',
      ...options,
    })

  try {
    let archive
    if (tarball) {
      archive = path.resolve(tarball)
    } else {
      const [{ filename }] = JSON.parse(
        npm(
          [
            'pack',
            '--ignore-scripts',
            '--foreground-scripts=false',
            '--json',
            '--pack-destination',
            consumerDirectory,
          ],
          {
            cwd: projectDirectory,
            encoding: 'utf8',
            stdio: 'pipe',
            // Older npm 10 still runs prepare despite --ignore-scripts.
            env: { ...process.env, HUSKY: '0' },
          },
        ),
      )
      archive = path.join(consumerDirectory, filename)
    }
    writeFileSync(
      path.join(consumerDirectory, 'package.json'),
      JSON.stringify({ private: true, type: 'module' }),
    )
    npm([
      'install',
      archive,
      '--omit=dev',
      '--ignore-scripts',
      '--engine-strict',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
    ])
    validate({ consumerDirectory, archive })
  } finally {
    rmSync(consumerDirectory, { recursive: true, force: true })
  }
}

export const testInstalledRuntime = (consumerDirectory) => {
  cpSync(
    path.join(projectDirectory, 'tests'),
    path.join(consumerDirectory, 'tests'),
    { recursive: true },
  )
  execFileSync(
    process.execPath,
    [
      '--test',
      'tests/index.test.js',
      'tests/subprocess.test.js',
      'tests/signals.test.js',
    ],
    {
      cwd: consumerDirectory,
      stdio: 'inherit',
      timeout: 600_000,
      killSignal: 'SIGKILL',
    },
  )
}
