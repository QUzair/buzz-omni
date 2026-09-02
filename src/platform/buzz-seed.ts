#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process'
import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
const relayUrl = 'http://127.0.0.1:8010'
const identityPath = resolve('.local/buzz/identities.json')
const seedStatePath = resolve('.local/buzz/seed-state.json')
const computeAuthTagPath = resolve('.local/bin/compute_auth_tag')
const composeArgs = ['compose', '--env-file', '.local/buzz/buzz.env', '-f', 'infra/buzz/compose.yml']

type Keypair = { publicKey: string; secretKey: string }
type IdentityState = { version: 1; identities: Record<string, Keypair> }
type SeedState = {
  version: 1
  channels: Record<string, string>
  messagesSeeded: string[]
  authTags: Record<string, string>
}

export const humanProfiles = {
  owner: { name: 'Aisha Khan', about: 'Mastercard Commerce Operations · Platform owner' },
  maya_patel: { name: 'Maya Patel', about: 'Mastercard Commerce Operations · Network Duty Manager' },
  elena_rossi: { name: 'Elena Rossi', about: 'Mastercard Commerce Operations · Regional Operations Lead' },
  jon_bell: { name: 'Jon Bell', about: 'Mastercard Commerce Operations · Site Reliability Engineer' },
  priya_shah: { name: 'Priya Shah', about: 'Mastercard Commerce Operations · Digital Payments Product Lead' },
} as const

const agentProfiles = {
  network_operations: { name: 'NetworkOps', about: 'Owner-attested Omnigent agent · Authorization-health triage' },
  fraud_review: { name: 'FraudReview', about: 'Owner-attested Omnigent agent · Suspicious-activity review' },
  tokenization_readiness: { name: 'TokenLaunch', about: 'Owner-attested Omnigent agent · Tokenization launch readiness' },
  settlement_support: { name: 'SettlementOps', about: 'Owner-attested Omnigent agent · Settlement variance support' },
  compliance_review: { name: 'ComplianceReview', about: 'Owner-attested Omnigent agent · Control evidence review' },
} as const

type HumanIdentity = keyof typeof humanProfiles
export type AgentIdentity = keyof typeof agentProfiles
export const agentIdentityNames = Object.keys(agentProfiles) as AgentIdentity[]

type SeedMessage = { author: HumanIdentity; content: string }
type ChannelSeed = {
  name: string
  description: string
  agent: AgentIdentity
  members: HumanIdentity[]
  messages: SeedMessage[]
}

export const channelCatalog: readonly ChannelSeed[] = [
  {
    name: 'network-operations',
    description: 'Authorization health and regional incident triage · synthetic modeled data',
    agent: 'network_operations',
    members: ['maya_patel', 'elena_rossi', 'jon_bell'],
    messages: [
      { author: 'maya_patel', content: 'Issuer monitoring shows an 8% authorization dip across the DE and FR corridors. No broad availability alert is active.' },
      { author: 'jon_bell', content: 'Edge latency is within baseline. The timing overlaps yesterday’s routing configuration, but correlation is not causation.' },
      { author: 'elena_rossi', content: 'Please separate planned issuer maintenance from the residual signal before we draft the regional incident update.' },
    ],
  },
  {
    name: 'fraud-intelligence',
    description: 'Suspicious activity investigation and approval-gated controls · synthetic modeled data',
    agent: 'fraud_review',
    members: ['maya_patel', 'elena_rossi', 'priya_shah'],
    messages: [
      { author: 'maya_patel', content: 'Synthetic merchant DEMO-M-204 has a short burst of low-value retries across newly observed accounts.' },
      { author: 'priya_shah', content: 'Product telemetry shows no related checkout release. Treat any block or rule change as a proposal only.' },
      { author: 'elena_rossi', content: 'We need evidence, confidence, and an approval path—not an autonomous enforcement action.' },
    ],
  },
  {
    name: 'tokenization-launch',
    description: 'Token-requestor certification and launch gating · synthetic modeled data',
    agent: 'tokenization_readiness',
    members: ['priya_shah', 'elena_rossi', 'jon_bell'],
    messages: [
      { author: 'priya_shah', content: 'Requestor TR-DEMO-781 is targeting the next launch window. We need a clear go/no-go view by certification gate.' },
      { author: 'jon_bell', content: 'The callback endpoint is stable in the modeled environment; key-rotation evidence still needs to be checked.' },
      { author: 'elena_rossi', content: 'Name each blocker and owner. Do not represent a recommendation as final launch approval.' },
    ],
  },
  {
    name: 'settlement-operations',
    description: 'Settlement discrepancy and batch-variance investigation · synthetic modeled data',
    agent: 'settlement_support',
    members: ['maya_patel', 'elena_rossi', 'jon_bell'],
    messages: [
      { author: 'maya_patel', content: 'Modeled batch SET-DEMO-042 is outside the expected variance band after the overnight cycle.' },
      { author: 'jon_bell', content: 'Transport acknowledgements are complete. The remaining hypotheses are cutoff timing or source-record duplication.' },
      { author: 'elena_rossi', content: 'Trace the variance without changing settlement state and give us the next safe verification step.' },
    ],
  },
  {
    name: 'compliance-evidence',
    description: 'Internal control evidence and review preparation · synthetic modeled data',
    agent: 'compliance_review',
    members: ['maya_patel', 'elena_rossi', 'priya_shah'],
    messages: [
      { author: 'elena_rossi', content: 'The quarterly review needs the latest modeled evidence for control CTRL-DEMO-17.' },
      { author: 'priya_shah', content: 'Please distinguish missing evidence from a failed control. This is an internal demo, not legal advice.' },
      { author: 'maya_patel', content: 'A concise evidence inventory and owner list will be enough for the review handoff.' },
    ],
  },
] as const

export function extractChannelId(value: unknown): string | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractChannelId(item)
      if (found) return found
    }
    return undefined
  }
  if (!value || typeof value !== 'object') return undefined
  const record = value as Record<string, unknown>
  for (const key of ['channel_id', 'id']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && isUuid(candidate)) return candidate.toLowerCase()
  }
  for (const nested of Object.values(record)) {
    const found = extractChannelId(nested)
    if (found) return found
  }
  return undefined
}

export function normalizeDesktopPublicKey(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined
  const publicKey = value.trim().toLowerCase()
  if (!isHex(publicKey, 64)) {
    throw new Error('BUZZ_DESKTOP_PUBKEY must be a 64-character hexadecimal Buzz public key')
  }
  return publicKey
}

export async function seedBuzz(
  desktopPublicKeyInput: string | undefined = process.env.BUZZ_DESKTOP_PUBKEY,
): Promise<{ channels: Record<string, string>; seededMessages: string[]; desktopMemberEnrolled: boolean }> {
  const identities = await readIdentities()
  const state = await readSeedState()
  const desktopPublicKey = normalizeDesktopPublicKey(desktopPublicKeyInput)

  for (const identityName of Object.keys(humanProfiles).filter((name) => name !== 'owner')) {
    await addRelayMember(identities[identityName]!.publicKey)
  }
  if (desktopPublicKey) await addRelayMember(desktopPublicKey)

  for (const [identityName, profile] of Object.entries(humanProfiles)) {
    await setProfile(identities[identityName]!, profile)
  }

  for (const [identityName, profile] of Object.entries(agentProfiles)) {
    const pair = identities[identityName]!
    const authTag = state.authTags[identityName] ?? await computeAuthTag(identities.owner!, pair.publicKey)
    state.authTags[identityName] = authTag
    await setProfile(pair, profile, authTag)
  }

  for (const channel of channelCatalog) {
    const channelId = state.channels[channel.name] ?? await findOrCreateChannel(identities.owner!, channel)
    state.channels[channel.name] = channelId
    await addChannelMember(identities.owner!, channelId, identities[channel.agent]!.publicKey, 'bot')
    for (const member of channel.members) {
      await addChannelMember(identities.owner!, channelId, identities[member]!.publicKey, 'member')
    }
    if (desktopPublicKey) {
      await addChannelMember(identities.owner!, channelId, desktopPublicKey, 'member')
    }
    if (!state.messagesSeeded.includes(channel.name)) {
      for (const message of channel.messages) {
        await sendMessage(identities[message.author]!, channelId, message.content)
      }
      state.messagesSeeded.push(channel.name)
    }
    await writeSeedState(state)
  }

  return {
    channels: state.channels,
    seededMessages: [...state.messagesSeeded],
    desktopMemberEnrolled: Boolean(desktopPublicKey),
  }
}

async function readIdentities(): Promise<Record<string, Keypair>> {
  const raw = JSON.parse(await readFile(identityPath, 'utf8')) as IdentityState
  if (raw.version !== 1 || !raw.identities) throw new Error('Buzz identity state is missing or incompatible')
  for (const name of [...Object.keys(humanProfiles), ...agentIdentityNames]) {
    const pair = raw.identities[name]
    if (!pair || !isHex(pair.publicKey, 64) || !isHex(pair.secretKey, 64)) throw new Error(`Invalid Buzz identity: ${name}`)
  }
  return raw.identities
}

async function readSeedState(): Promise<SeedState> {
  try {
    const raw = JSON.parse(await readFile(seedStatePath, 'utf8')) as Partial<SeedState>
    if (raw.version !== 1 || !raw.channels || !raw.messagesSeeded || !raw.authTags) throw new Error('incompatible')
    return raw as SeedState
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error('Buzz seed state is malformed; refusing to overwrite it')
    return { version: 1, channels: {}, messagesSeeded: [], authTags: {} }
  }
}

async function addRelayMember(publicKey: string): Promise<void> {
  await run('docker', [
    ...composeArgs, 'exec', '-T', 'relay', '/usr/local/bin/buzz-admin',
    'add-member', '--pubkey', publicKey, '--role', 'member',
  ])
}

async function setProfile(identity: Keypair, profile: { name: string; about: string }, authTag?: string): Promise<void> {
  await runBuzz(identity, ['users', 'set-profile', '--name', profile.name, '--about', profile.about], authTag)
}

async function computeAuthTag(owner: Keypair, agentPublicKey: string): Promise<string> {
  const output = await run(computeAuthTagPath, [owner.secretKey, agentPublicKey, ''])
  const parsed = JSON.parse(output) as unknown
  if (!Array.isArray(parsed) || parsed.length !== 4 || parsed[0] !== 'auth' || parsed[1] !== owner.publicKey) {
    throw new Error('Could not create a valid owner attestation for a Buzz agent')
  }
  return JSON.stringify(parsed)
}

async function findOrCreateChannel(owner: Keypair, channel: ChannelSeed): Promise<string> {
  const search = await runBuzzJson(owner, ['channels', 'search', '--query', channel.name, '--exact'])
  const existing = extractChannelId(search)
  if (existing) return existing
  const created = await runBuzzJson(owner, [
    'channels', 'create', '--name', channel.name, '--type', 'stream', '--visibility', 'private',
    '--description', channel.description,
  ])
  const id = extractChannelId(created)
  if (!id) throw new Error(`Buzz did not return an ID for #${channel.name}`)
  return id
}

async function addChannelMember(owner: Keypair, channelId: string, publicKey: string, role: 'member' | 'bot'): Promise<void> {
  await runBuzz(owner, ['channels', 'add-member', '--channel', channelId, '--pubkey', publicKey, '--role', role])
}

async function sendMessage(author: Keypair, channelId: string, content: string): Promise<void> {
  await runBuzz(author, ['messages', 'send', '--channel', channelId, '--content', content])
}

async function runBuzz(identity: Keypair, args: string[], authTag?: string): Promise<string> {
  return run(process.env.BUZZ_CLI?.trim() || 'buzz', args, {
    ...process.env,
    BUZZ_RELAY_URL: relayUrl,
    BUZZ_PRIVATE_KEY: identity.secretKey,
    ...(authTag ? { BUZZ_AUTH_TAG: authTag } : {}),
  })
}

async function runBuzzJson(identity: Keypair, args: string[]): Promise<unknown> {
  const output = await runBuzz(identity, args)
  return output.trim() ? JSON.parse(output) as unknown : {}
}

async function run(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const { stdout } = await execFile(command, args, { cwd: resolve('.'), env, encoding: 'utf8', maxBuffer: 1024 * 1024 })
  return stdout
}

async function writeSeedState(state: SeedState): Promise<void> {
  await mkdir(resolve('.local/buzz'), { recursive: true, mode: 0o700 })
  const temporary = `${seedStatePath}.${process.pid}.tmp`
  const handle = await open(temporary, 'w', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(state, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, seedStatePath)
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isHex(value: string, length: number): boolean {
  return new RegExp(`^[0-9a-f]{${length}}$`, 'i').test(value)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await seedBuzz()
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not seed Buzz'
    process.stderr.write(`[buzz-seed] ${message}\n`)
    process.exitCode = 1
  }
}
