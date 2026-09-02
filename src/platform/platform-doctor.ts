#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process'
import { access, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { loadPlatformEnvironment, readPlatformOptions } from './platform-env.js'

const execFile = promisify(execFileCallback)

export type PlatformConfigurationReport = {
  provider?: 'copilot' | 'gemini'
  errors: string[]
  warnings: string[]
}

type CheckResult = { label: string; ok: boolean; detail?: string }

export function inspectPlatformConfiguration(environment: NodeJS.ProcessEnv): PlatformConfigurationReport {
  const errors: string[] = []
  const warnings: string[] = []
  let provider: PlatformConfigurationReport['provider']
  try {
    provider = readPlatformOptions(environment).provider
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Platform configuration is invalid')
  }
  if (!environment.BUZZ_DESKTOP_PUBKEY?.trim()) {
    warnings.push('BUZZ_DESKTOP_PUBKEY is not set; a fresh Buzz Desktop identity will not be enrolled automatically')
  }
  return { provider, errors, warnings }
}

export async function runPlatformDoctor(
  environment: NodeJS.ProcessEnv,
  envFileLoaded: boolean,
): Promise<boolean> {
  const report = inspectPlatformConfiguration(environment)
  const checks: CheckResult[] = [
    checkNodeVersion(),
    await checkCommand('Git', 'git', ['--version']),
    await checkCommand('Rust/Cargo', 'cargo', ['--version']),
    await checkCommand('Docker CLI', 'docker', ['--version']),
    await checkCommand('Docker daemon', 'docker', ['info', '--format', '{{.ServerVersion}}']),
    await checkCommand('uv', 'uv', ['--version']),
    await checkCommand('Omnigent', 'omnigent', ['--version']),
    await checkExecutable('Buzz CLI', resolve('.local/bin/buzz')),
    await checkExecutable('Buzz ACP listener', resolve('.local/bin/buzz-acp')),
    await checkExecutable('Buzz remote-agent directory publisher', resolve('.local/bin/publish_agent_directory')),
    await checkPath('Buzz Desktop', '/Applications/Buzz.app'),
  ]
  if (report.provider === 'copilot') {
    checks.push(await checkCommand('GitHub CLI authentication', 'gh', ['auth', 'status']))
    checks.push(await checkCopilotSdk())
  }

  process.stdout.write('Local Buzz + Omnigent platform doctor\n\n')
  process.stdout.write(`${envFileLoaded ? '✓' : '!'} .env ${envFileLoaded ? 'loaded' : 'not found; shell values and defaults will be used'}\n`)
  for (const check of checks) {
    process.stdout.write(`${check.ok ? '✓' : '✗'} ${check.label}${check.detail ? ` — ${check.detail}` : ''}\n`)
  }
  for (const warning of report.warnings) process.stdout.write(`! ${warning}\n`)
  for (const error of report.errors) process.stderr.write(`✗ ${error}\n`)

  const okay = report.errors.length === 0 && checks.every((check) => check.ok)
  process.stdout.write(`\n${okay ? 'Ready to run npm run demo.' : 'Not ready; resolve the failed checks above.'}\n`)
  return okay
}

function checkNodeVersion(): CheckResult {
  const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
  const ok = major > 20 || (major === 20 && minor >= 11)
  return { label: 'Node.js', ok, detail: `v${process.versions.node}` }
}

async function checkCommand(label: string, command: string, args: string[]): Promise<CheckResult> {
  try {
    await execFile(command, args, { encoding: 'utf8', timeout: 10_000, maxBuffer: 1024 * 1024 })
    return { label, ok: true }
  } catch {
    return { label, ok: false }
  }
}

async function checkCopilotSdk(): Promise<CheckResult> {
  try {
    const { stdout } = await execFile('uv', ['tool', 'dir'], { encoding: 'utf8', timeout: 10_000 })
    const python = resolve(stdout.trim(), 'omnigent', 'bin', 'python')
    await execFile(python, ['-c', 'import copilot'], { encoding: 'utf8', timeout: 10_000 })
    return { label: 'GitHub Copilot SDK', ok: true }
  } catch {
    return { label: 'GitHub Copilot SDK', ok: false, detail: 'run npm run setup' }
  }
}

async function checkExecutable(label: string, path: string): Promise<CheckResult> {
  try {
    await access(path, constants.X_OK)
    return { label, ok: true }
  } catch {
    return { label, ok: false, detail: 'run npm run setup' }
  }
}

async function checkPath(label: string, path: string): Promise<CheckResult> {
  try {
    await stat(path)
    return { label, ok: true }
  } catch {
    return { label, ok: false, detail: path }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const loaded = await loadPlatformEnvironment()
  const okay = await runPlatformDoctor(loaded.environment, loaded.loaded)
  if (!okay) process.exitCode = 1
}
