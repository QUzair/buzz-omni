#!/usr/bin/env node
import { execFile as execFileCallback, spawn, type ChildProcess } from 'node:child_process'
import { closeSync, openSync } from 'node:fs'
import { mkdir, open, readFile, rename, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'
import { promisify } from 'node:util'
import { agentDefinitions } from './provider-profiles.js'
import { renderAgentProfiles } from './render-agents.js'
import { createBuzzSecrets } from './buzz-secrets.js'
import { channelCatalog, seedBuzz, type AgentIdentity } from './buzz-seed.js'
import { loadPlatformEnvironment, readPlatformOptions } from './platform-env.js'

const execFile = promisify(execFileCallback)
const root = resolve('.')
const localRoot = resolve('.local')
const logsRoot = resolve(localRoot, 'logs')
const buzzAcpPath = resolve(localRoot, 'bin/buzz-acp')
const buzzCliPath = resolve(localRoot, 'bin/buzz')
const bridgePath = resolve('dist/src/cli.js')
const relayHttpUrl = 'http://127.0.0.1:8010'
const relayWsUrl = 'ws://127.0.0.1:8010'
const omnigentUrl = 'http://127.0.0.1:8013'
const statusPort = 8014
const composeArgs = ['compose', '--env-file', '.local/buzz/buzz.env', '-f', 'infra/buzz/compose.yml']

type IdentityName = 'owner' | 'maya_patel' | 'elena_rossi' | 'jon_bell' | 'priya_shah' | AgentIdentity
type Keypair = { publicKey: string; secretKey: string }
type RuntimeDefinition = {
  identity: AgentIdentity
  agentName: string
  agentSlug: string
  channel: string
  allowedEmployees: IdentityName[]
}
type AgentEnvironmentInput = {
  identities: Record<string, Keypair>
  authTag: string
  desktopPublicKey?: string
  omnigentAgentId: string
  omnigentHostId: string
  workspace: string
  bridgePath: string
}

const identityBySlug: Record<string, AgentIdentity> = {
  'network-operations': 'network_operations',
  'fraud-review': 'fraud_review',
  'tokenization-readiness': 'tokenization_readiness',
  'settlement-support': 'settlement_support',
  'compliance-review': 'compliance_review',
}
const channelByAgent: Record<AgentIdentity, string> = Object.fromEntries(
  channelCatalog.map((channel) => [channel.agent, channel.name]),
) as Record<AgentIdentity, string>
const employeesByAgent: Record<AgentIdentity, IdentityName[]> = Object.fromEntries(
  channelCatalog.map((channel) => [channel.agent, [...channel.members]]),
) as Record<AgentIdentity, IdentityName[]>

export const runtimeCatalog: readonly RuntimeDefinition[] = agentDefinitions.map((agent) => {
  const identity = identityBySlug[agent.slug]
  if (!identity) throw new Error(`No Buzz identity is mapped to ${agent.slug}`)
  return {
    identity,
    agentName: agent.name,
    agentSlug: agent.slug,
    channel: channelByAgent[identity],
    allowedEmployees: employeesByAgent[identity],
  }
})

export function buildAgentEnvironment(
  runtime: RuntimeDefinition,
  input: AgentEnvironmentInput,
  baseEnvironment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const identity = requireIdentity(input.identities, runtime.identity)
  const allowlist = [...new Set([
    ...runtime.allowedEmployees.map((name) => requireIdentity(input.identities, name).publicKey),
    ...(input.desktopPublicKey ? [input.desktopPublicKey] : []),
  ])].join(',')
  return {
    ...baseEnvironment,
    PYTHONPATH: root,
    BUZZ_RELAY_URL: relayWsUrl,
    BUZZ_HTTP_RELAY_URL: relayHttpUrl,
    BUZZ_PRIVATE_KEY: identity.secretKey,
    BUZZ_AUTH_TAG: input.authTag,
    BUZZ_ACP_AGENT_COMMAND: process.execPath,
    BUZZ_ACP_AGENT_ARGS: input.bridgePath,
    BUZZ_CLI: buzzCliPath,
    BUZZ_ACP_RESPOND_TO: 'allowlist',
    BUZZ_ACP_RESPOND_TO_ALLOWLIST: allowlist,
    BUZZ_ACP_ALLOWED_RESPOND_TO: 'owner-only,allowlist',
    BUZZ_ACP_SESSION_POLICY: 'channel',
    BUZZ_ACP_MULTIPLE_EVENT_HANDLING: 'steer',
    BUZZ_ACP_CONTEXT_MESSAGE_LIMIT: '12',
    BUZZ_ACP_IDLE_TIMEOUT: '300',
    BUZZ_ACP_MAX_TURN_DURATION: '900',
    BUZZ_ACP_SESSION_TITLE: `Buzz #${runtime.channel}`,
    OMNIGENT_BASE_URL: omnigentUrl,
    OMNIGENT_AGENT_ID: input.omnigentAgentId,
    OMNIGENT_HOST_ID: input.omnigentHostId,
    OMNIGENT_WORKSPACE: input.workspace,
  }
}

type RuntimeStatus = {
  provider: string
  relay: string
  omnigent: string
  hostId: string
  desktopMemberEnrolled: boolean
  communities: Array<{ channel: string; agent: string; pid: number | undefined }>
  startedAt: string
}

async function runPlatform(): Promise<void> {
  const loadedEnvironment = await loadPlatformEnvironment()
  const runtimeEnvironment = loadedEnvironment.environment
  const options = readPlatformOptions(runtimeEnvironment)
  const provider = options.provider
  await requireExecutable(buzzAcpPath, 'Run npm run platform:bootstrap to build the pinned upstream buzz-acp binary')
  await requireExecutable(buzzCliPath, 'Run npm run platform:bootstrap to build the pinned upstream Buzz CLI')
  process.env.BUZZ_CLI = buzzCliPath
  await mkdir(logsRoot, { recursive: true, mode: 0o700 })
  await mkdir(resolve(localRoot, 'omnigent/artifacts'), { recursive: true, mode: 0o700 })
  await mkdir(resolve(localRoot, 'omnigent/workspaces'), { recursive: true, mode: 0o700 })

  const agentPaths = await renderAgentProfiles(provider, resolve(localRoot, 'agents'))
  await createBuzzSecrets(resolve(localRoot, 'buzz'))
  const children: ChildProcess[] = []
  try {
    await exec('docker', [...composeArgs, 'up', '-d', '--wait'])
    await waitForHealth(`${relayHttpUrl.replace(':8010', ':8011')}/_readiness`, 45_000)
    const seed = await seedBuzz(options.desktopPublicKey)

    const omnigentLog = openSync(resolve(logsRoot, 'omnigent-server.log'), 'w', 0o600)
    const server = spawn('omnigent', [
      'server', '--host', '127.0.0.1', '--port', '8013',
      '--database-uri', `sqlite:///${resolve(localRoot, 'omnigent/chat.db')}`,
      '--artifact-location', resolve(localRoot, 'omnigent/artifacts'),
      ...agentPaths.flatMap((path) => ['--agent', path]), '--no-open',
    ], { cwd: root, env: { ...runtimeEnvironment, PYTHONPATH: root }, stdio: ['ignore', omnigentLog, omnigentLog] })
    closeSync(omnigentLog)
    children.push(server)
    await waitForHealth(`${omnigentUrl}/health`, 60_000)

    await exec('omnigent', ['host', omnigentUrl, '--background', '--non-interactive'], { ...runtimeEnvironment, PYTHONPATH: root })
    const hostId = await waitForOmnigentHost(60_000)
    const identities = await loadIdentities()
    const seedState = await loadSeedState()
    const agentIds = await loadOmnigentAgentIds()

    const communityProcesses: RuntimeStatus['communities'] = []
    for (const runtime of runtimeCatalog) {
      const workspace = resolve(localRoot, 'omnigent/workspaces', runtime.agentSlug)
      await mkdir(workspace, { recursive: true, mode: 0o700 })
      const agentId = agentIds[runtime.agentName]
      const authTag = seedState.authTags[runtime.identity]
      if (!agentId || !authTag) throw new Error(`Runtime state is incomplete for ${runtime.agentName}`)
      const log = openSync(resolve(logsRoot, `buzz-acp-${runtime.agentSlug}.log`), 'w', 0o600)
      const child = spawn(buzzAcpPath, [], {
        cwd: root,
        env: buildAgentEnvironment(runtime, {
          identities,
          authTag,
          desktopPublicKey: options.desktopPublicKey,
          omnigentAgentId: agentId,
          omnigentHostId: hostId,
          workspace,
          bridgePath,
        }, runtimeEnvironment),
        stdio: ['ignore', log, log],
      })
      closeSync(log)
      children.push(child)
      communityProcesses.push({ channel: runtime.channel, agent: runtime.agentName, pid: child.pid })
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 1_500))
    for (const child of children) {
      if (child.exitCode !== null) throw new Error(`A platform service exited during startup with code ${child.exitCode}`)
    }

    const status: RuntimeStatus = {
      provider,
      relay: relayHttpUrl,
      omnigent: omnigentUrl,
      hostId,
      desktopMemberEnrolled: seed.desktopMemberEnrolled,
      communities: communityProcesses,
      startedAt: new Date().toISOString(),
    }
    await atomicWrite(resolve(localRoot, 'platform/runtime-state.json'), `${JSON.stringify({ ...status, channels: seed.channels }, null, 2)}\n`)
    const statusServer = await startStatusServer(status)

    process.stdout.write([
      `Buzz relay:      ${relayHttpUrl}`,
      `Omnigent UI:     ${omnigentUrl}`,
      `Platform status: http://127.0.0.1:${statusPort}`,
      `Provider:        ${provider}`,
      `Environment:     ${loadedEnvironment.loaded ? loadedEnvironment.path : 'shell/defaults (.env not found)'}`,
      `Communities:     ${communityProcesses.length} private Buzz channels`,
      `Buzz Desktop:    ${seed.desktopMemberEnrolled ? 'public key enrolled' : 'set BUZZ_DESKTOP_PUBKEY to enroll a fresh client'}`,
      'Press Ctrl-C to stop the local platform.',
      '',
    ].join('\n'))

    if (options.openBuzzDesktop) {
      try {
        await exec('open', ['-a', 'Buzz'], runtimeEnvironment)
      } catch {
        process.stderr.write('[platform] Buzz Desktop could not be opened automatically; open /Applications/Buzz.app manually.\n')
      }
    }

    await waitForShutdown(children, statusServer)
  } catch (error) {
    for (const child of [...children].reverse()) if (child.exitCode === null) child.kill('SIGTERM')
    try { await exec('omnigent', ['host', 'stop', '--server', omnigentUrl, '--daemon-only', '--force']) } catch { /* no daemon */ }
    try { await exec('docker', [...composeArgs, 'down']) } catch { /* cleanup is best-effort */ }
    throw error
  }
}

async function startStatusServer(status: RuntimeStatus): Promise<Server> {
  const server = createServer(async (request, response) => {
    if (request.url === '/health') {
      response.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
      response.end(JSON.stringify({ status: 'ok', provider: status.provider, agents: status.communities.length }))
      return
    }
    const relayOk = await isHealthy('http://127.0.0.1:8011/_readiness')
    const omnigentOk = await isHealthy(`${omnigentUrl}/health`)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' })
    response.end(renderStatusPage(status, relayOk, omnigentOk))
  })
  await new Promise<void>((resolveListening, rejectListening) => {
    const onError = (error: Error) => {
      server.off('listening', onListening)
      rejectListening(error)
    }
    const onListening = () => {
      server.off('error', onError)
      resolveListening()
    }
    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(statusPort, '127.0.0.1')
  })
  return server
}

function renderStatusPage(status: RuntimeStatus, relayOk: boolean, omnigentOk: boolean): string {
  const rows = status.communities.map(({ channel, agent, pid }) => `<tr><td>#${escapeHtml(channel)}</td><td>${escapeHtml(agent)}</td><td>listening</td><td>${pid ?? '—'}</td></tr>`).join('')
  const desktop = status.desktopMemberEnrolled ? '<span class="badge">Buzz Desktop enrolled</span>' : ''
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mastercard Buzz + Omnigent POC</title><style>body{font:15px system-ui;background:#111;color:#eee;margin:0}main{max-width:980px;margin:48px auto;padding:0 24px}h1{font-size:34px}.badge{display:inline-block;padding:6px 10px;border-radius:20px;background:#28332d;color:#9ff0b8;margin-right:8px}.bad{background:#3b2424;color:#ffb3b3}section{background:#1b1b1b;border:1px solid #333;border-radius:16px;padding:22px;margin:20px 0}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:11px;border-bottom:1px solid #303030}a{color:#9fc9ff}code{color:#ffd9a1}</style></head><body><main><p>LOCAL CONTROL PLANE · REAL COMPONENT STATUS</p><h1>Mastercard Buzz + Omnigent POC</h1><p><span class="badge ${relayOk ? '' : 'bad'}">Buzz relay ${relayOk ? 'ready' : 'down'}</span><span class="badge ${omnigentOk ? '' : 'bad'}">Omnigent ${omnigentOk ? 'ready' : 'down'}</span><span class="badge">${escapeHtml(status.provider)}</span>${desktop}</p><section><h2>Live architecture</h2><p>Signed Buzz mention → upstream <code>buzz-acp</code> → local Omnigent runner → sandboxed modeled tool → signed threaded Buzz reply.</p><p><a href="${status.relay}">Buzz relay NIP-11</a> · <a href="${status.omnigent}">Omnigent session UI</a></p></section><section><h2>Membership-scoped Buzz channels</h2><table><thead><tr><th>Buzz channel</th><th>Omnigent agent</th><th>Listener</th><th>PID</th></tr></thead><tbody>${rows}</tbody></table></section><p>All operational tool data is explicitly synthetic. The collaboration, identities, signatures, channel state, ACP lifecycle, sessions, sandbox and model harness are live local components.</p></main></body></html>`
}

async function waitForShutdown(children: ChildProcess[], statusServer: Server): Promise<void> {
  await new Promise<void>((resolveShutdown, rejectShutdown) => {
    let stopping = false
    const stop = async (failure?: Error) => {
      if (stopping) return
      stopping = true
      statusServer.close()
      for (const child of [...children].reverse()) if (child.exitCode === null) child.kill('SIGTERM')
      try { await exec('omnigent', ['host', 'stop', '--server', omnigentUrl]) } catch { /* already stopped */ }
      try { await exec('docker', [...composeArgs, 'down']) } catch { /* leave cleanup best-effort */ }
      if (failure) rejectShutdown(failure)
      else resolveShutdown()
    }
    process.once('SIGINT', () => { void stop() })
    process.once('SIGTERM', () => { void stop() })
    for (const child of children) child.once('exit', (code, signal) => {
      if (!stopping) {
        void stop(new Error(`A platform service exited unexpectedly (${signal || `code ${code ?? 'unknown'}`})`))
      }
    })
  })
}

async function waitForHealth(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await isHealthy(url)) return
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  throw new Error(`Timed out waiting for ${url}`)
}

async function isHealthy(url: string): Promise<boolean> {
  try { return (await fetch(url, { signal: AbortSignal.timeout(1_000) })).ok } catch { return false }
}

async function waitForOmnigentHost(timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const payload = await fetch(`${omnigentUrl}/v1/hosts`).then((response) => response.json()) as { hosts?: Array<{ host_id?: string; status?: string }> }
      const online = payload.hosts?.find((host) => host.status === 'online' && typeof host.host_id === 'string')
      if (online?.host_id) return online.host_id
    } catch { /* keep waiting */ }
    await new Promise((resolveWait) => setTimeout(resolveWait, 500))
  }
  throw new Error('Timed out waiting for the local Omnigent host')
}

async function loadOmnigentAgentIds(): Promise<Record<string, string>> {
  const payload = await fetch(`${omnigentUrl}/v1/agents`).then((response) => response.json()) as { data?: Array<{ id?: string; name?: string }> }
  return Object.fromEntries((payload.data || []).filter((agent): agent is { id: string; name: string } => Boolean(agent.id && agent.name)).map((agent) => [agent.name, agent.id]))
}

async function loadIdentities(): Promise<Record<string, Keypair>> {
  const payload = JSON.parse(await readFile(resolve(localRoot, 'buzz/identities.json'), 'utf8')) as { identities?: Record<string, Keypair> }
  if (!payload.identities) throw new Error('Buzz identities are missing')
  return payload.identities
}

async function loadSeedState(): Promise<{ authTags: Record<string, string> }> {
  const payload = JSON.parse(await readFile(resolve(localRoot, 'buzz/seed-state.json'), 'utf8')) as { authTags?: Record<string, string> }
  if (!payload.authTags) throw new Error('Buzz seed state is missing')
  return { authTags: payload.authTags }
}

function requireIdentity(identities: Record<string, Keypair>, name: string): Keypair {
  const identity = identities[name]
  if (!identity) throw new Error(`Buzz identity ${name} is missing`)
  return identity
}

async function requireExecutable(path: string, message: string): Promise<void> {
  try {
    const info = await stat(path)
    if ((info.mode & 0o111) !== 0) return
  } catch { /* handled below */ }
  throw new Error(message)
}

async function exec(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const { stdout } = await execFile(command, args, { cwd: root, env, encoding: 'utf8', maxBuffer: 1024 * 1024 })
  return stdout
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(resolve(path, '..'), { recursive: true, mode: 0o700 })
  const temporary = `${path}.${process.pid}.tmp`
  const handle = await open(temporary, 'w', 0o600)
  try { await handle.writeFile(content, 'utf8'); await handle.sync() } finally { await handle.close() }
  await rename(temporary, path)
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runPlatform().catch((error) => {
    const message = error instanceof Error ? error.message : 'Platform startup failed'
    process.stderr.write(`[platform] ${message}\n`)
    process.exitCode = 1
  })
}
