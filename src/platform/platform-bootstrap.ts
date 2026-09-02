#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process'
import { chmod, copyFile, mkdir, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
export const BUZZ_SOURCE_COMMIT = '1c8321cd08feb597f8bcff5195c21148fb3e98ed'
export const OMNIGENT_SOURCE_COMMIT = 'f2a670b348f7110bf4ea18b643bcd3852f1d9712'
const root = resolve('.')
const sourceRoot = resolve('.local/upstream/buzz')
const binaryRoot = resolve('.local/bin')
const directoryPublisherSource = resolve('native/publish_agent_directory.rs')
const directoryPublisherTarget = resolve(sourceRoot, 'crates/buzz-cli/examples/publish_agent_directory.rs')

export async function bootstrapPlatform(): Promise<{ buzzCommit: string; omnigentCommit: string; binaries: string[] }> {
  await requireCommand('git')
  await requireCommand('cargo')
  await requireCommand('docker')
  await requireCommand('uv')
  await mkdir(resolve('.local/upstream'), { recursive: true, mode: 0o700 })
  await mkdir(binaryRoot, { recursive: true, mode: 0o700 })

  if (!await exists(resolve(sourceRoot, '.git'))) {
    await exec('git', ['clone', '--filter=blob:none', 'https://github.com/block/buzz.git', sourceRoot])
  }
  const origin = (await exec('git', ['-C', sourceRoot, 'remote', 'get-url', 'origin'])).trim()
  if (!/(^|[:/])block\/buzz(?:\.git)?$/.test(origin)) throw new Error('Existing .local/upstream/buzz is not the upstream block/buzz repository')
  await exec('git', ['-C', sourceRoot, 'fetch', '--depth', '1', 'origin', BUZZ_SOURCE_COMMIT])
  await exec('git', ['-C', sourceRoot, 'checkout', '--detach', BUZZ_SOURCE_COMMIT])
  await mkdir(resolve(sourceRoot, 'crates/buzz-cli/examples'), { recursive: true })
  await copyFile(directoryPublisherSource, directoryPublisherTarget)
  await exec('cargo', [
    'build', '--release', '--locked',
    '-p', 'buzz-cli', '--bin', 'buzz',
    '-p', 'buzz-acp', '--bin', 'buzz-acp',
    '-p', 'buzz-sdk', '--example', 'compute_auth_tag',
    '-p', 'buzz-cli', '--example', 'publish_agent_directory',
  ], process.env, sourceRoot, 64 * 1024 * 1024)

  const binaries = [
    [resolve(sourceRoot, 'target/release/buzz'), resolve(binaryRoot, 'buzz')],
    [resolve(sourceRoot, 'target/release/buzz-acp'), resolve(binaryRoot, 'buzz-acp')],
    [resolve(sourceRoot, 'target/release/examples/compute_auth_tag'), resolve(binaryRoot, 'compute_auth_tag')],
    [resolve(sourceRoot, 'target/release/examples/publish_agent_directory'), resolve(binaryRoot, 'publish_agent_directory')],
  ] as const
  for (const [source, target] of binaries) {
    await copyFile(source, target)
    await chmod(target, 0o755)
  }

  if (!await omnigentMatchesPin()) {
    await exec('uv', [
      'tool', 'install', '--python', '3.13', '--force',
      `omnigent[antigravity,copilot] @ git+https://github.com/omnigent-ai/omnigent.git@${OMNIGENT_SOURCE_COMMIT}`,
    ], process.env, root, 64 * 1024 * 1024)
  }

  return {
    buzzCommit: BUZZ_SOURCE_COMMIT,
    omnigentCommit: OMNIGENT_SOURCE_COMMIT,
    binaries: binaries.map(([, target]) => target),
  }
}

async function omnigentMatchesPin(): Promise<boolean> {
  try {
    const output = await exec('omnigent', ['--version'])
    return output.includes(OMNIGENT_SOURCE_COMMIT.slice(0, 8))
  } catch { return false }
}

async function requireCommand(command: string): Promise<void> {
  try { await exec(command, ['--version']) } catch { throw new Error(`${command} is required to bootstrap the local platform`) }
}

async function exists(path: string): Promise<boolean> {
  try { await stat(path); return true } catch { return false }
}

async function exec(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = root,
  maxBuffer = 1024 * 1024,
): Promise<string> {
  const { stdout } = await execFile(command, args, { cwd, env, encoding: 'utf8', maxBuffer })
  return stdout
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrapPlatform().then((result) => {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  }).catch((error) => {
    const message = error instanceof Error ? error.message : 'Platform bootstrap failed'
    process.stderr.write(`[platform-bootstrap] ${message}\n`)
    process.exitCode = 1
  })
}
