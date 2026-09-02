#!/usr/bin/env node
import { execFile as execFileCallback } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { resolve } from 'node:path'
import { promisify } from 'node:util'

const execFile = promisify(execFileCallback)
export const BUZZ_IMAGE = 'ghcr.io/block/buzz:sha-1c8321c'

export type BuzzKeypair = { publicKey: string; secretKey: string }

type BuzzInfraSecrets = {
  ownerPublicKey: string
  relaySecretKey: string
  hookSecret: string
  postgresPassword: string
  redisPassword: string
  s3AccessKey: string
  s3SecretKey: string
}

type BuzzSecretState = {
  version: 1
  identities: Record<string, BuzzKeypair>
  infra: BuzzInfraSecrets
}

const identityNames = [
  'owner',
  'maya_patel',
  'elena_rossi',
  'jon_bell',
  'priya_shah',
  'network_operations',
  'fraud_review',
  'tokenization_readiness',
  'settlement_support',
  'compliance_review',
  'release_helper',
] as const

export function parseBuzzKeypair(output: string): BuzzKeypair {
  const publicKey = output.match(/^Public key:\s*([0-9a-f]{64})\s*$/im)?.[1]
  const secretKey = output.match(/^Secret key:\s*([0-9a-f]{64})\s*$/im)?.[1]
  if (!publicKey || !secretKey) throw new Error('buzz-admin did not return a valid keypair')
  return { publicKey: publicKey.toLowerCase(), secretKey: secretKey.toLowerCase() }
}

export function renderBuzzEnv(secrets: BuzzInfraSecrets): string {
  return [
    `BUZZ_IMAGE=${BUZZ_IMAGE}`,
    'BUZZ_HTTP_PORT=8010',
    'RELAY_URL=ws://127.0.0.1:8010',
    'BUZZ_MEDIA_BASE_URL=http://127.0.0.1:8010/media',
    'BUZZ_MEDIA_SERVER_DOMAIN=127.0.0.1:8010',
    'BUZZ_CORS_ORIGINS=http://127.0.0.1:8010',
    'BUZZ_REQUIRE_AUTH_TOKEN=false',
    'BUZZ_REQUIRE_RELAY_MEMBERSHIP=true',
    'BUZZ_ALLOW_NIP_OA_AUTH=true',
    'BUZZ_AUTO_MIGRATE=true',
    'BUZZ_GIT_CONFORMANCE_PROBE=false',
    'RUST_LOG=buzz_relay=info,buzz_db=info,buzz_auth=info,buzz_pubsub=info',
    `RELAY_OWNER_PUBKEY=${secrets.ownerPublicKey}`,
    `BUZZ_RELAY_PRIVATE_KEY=${secrets.relaySecretKey}`,
    `BUZZ_GIT_HOOK_HMAC_SECRET=${secrets.hookSecret}`,
    'POSTGRES_DB=buzz',
    'POSTGRES_USER=buzz',
    `POSTGRES_PASSWORD=${secrets.postgresPassword}`,
    `REDIS_PASSWORD=${secrets.redisPassword}`,
    `BUZZ_S3_ACCESS_KEY=${secrets.s3AccessKey}`,
    `BUZZ_S3_SECRET_KEY=${secrets.s3SecretKey}`,
    'BUZZ_S3_BUCKET=buzz-media',
    'BUZZ_S3_ADDRESSING_STYLE=path',
    '',
  ].join('\n')
}

export async function createBuzzSecrets(
  outputDirectory: string,
  generateKeypair: () => Promise<BuzzKeypair> = generateBuzzKeypair,
  randomHex: () => string = () => randomBytes(32).toString('hex'),
): Promise<{ created: boolean; identityNames: string[] }> {
  const root = resolve(outputDirectory)
  const statePath = resolve(root, 'identities.json')
  const envPath = resolve(root, 'buzz.env')
  await mkdir(root, { recursive: true, mode: 0o700 })

  let state: BuzzSecretState
  let created = false
  let existingContent: string | undefined
  try {
    existingContent = await readFile(statePath, 'utf8')
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  if (existingContent === undefined) {
    const identities: Record<string, BuzzKeypair> = {}
    for (const name of identityNames) identities[name] = await generateKeypair()
    const owner = identities.owner
    if (!owner) throw new Error('Could not generate the owner identity')
    state = {
      version: 1,
      identities,
      infra: {
        ownerPublicKey: owner.publicKey,
        relaySecretKey: randomHex(),
        hookSecret: randomHex(),
        postgresPassword: randomHex(),
        redisPassword: randomHex(),
        s3AccessKey: randomHex(),
        s3SecretKey: randomHex(),
      },
    }
    await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`, 0o600)
    created = true
  } else {
    let parsed: unknown
    try {
      parsed = JSON.parse(existingContent) as unknown
    } catch {
      throw new Error('Local Buzz identity state is malformed; refusing to overwrite it')
    }
    state = validateState(parsed)
    const missing = identityNames.filter((name) => !state.identities[name])
    if (missing.includes('owner')) {
      throw new Error('Local Buzz identity state has no owner; refusing to rotate identities')
    }
    for (const name of missing) state.identities[name] = await generateKeypair()
    if (missing.length > 0) {
      await atomicWrite(statePath, `${JSON.stringify(state, null, 2)}\n`, 0o600)
    }
  }

  await atomicWrite(envPath, renderBuzzEnv(state.infra), 0o600)
  return { created, identityNames: Object.keys(state.identities) }
}

async function generateBuzzKeypair(): Promise<BuzzKeypair> {
  const { stdout } = await execFile('docker', [
    'run', '--rm', '--entrypoint', '/usr/local/bin/buzz-admin',
    BUZZ_IMAGE, 'generate-key',
  ], { encoding: 'utf8', maxBuffer: 16 * 1024 })
  return parseBuzzKeypair(stdout)
}

function validateState(raw: unknown): BuzzSecretState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('missing state')
  const state = raw as Partial<BuzzSecretState>
  if (state.version !== 1 || !state.identities || !state.infra) throw new Error('missing state')
  for (const [name, pair] of Object.entries(state.identities)) {
    if (!pair || !/^[0-9a-f]{64}$/.test(pair.publicKey) || !/^[0-9a-f]{64}$/.test(pair.secretKey)) {
      throw new Error(`invalid local identity: ${name}`)
    }
  }
  const owner = state.identities.owner
  if (!owner || state.infra.ownerPublicKey !== owner.publicKey) throw new Error('invalid local identity: owner')
  return state as BuzzSecretState
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

async function atomicWrite(path: string, content: string, mode: number): Promise<void> {
  const temporary = `${path}.${process.pid}.tmp`
  const handle = await open(temporary, 'w', mode)
  try {
    await handle.writeFile(content, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  await rename(temporary, path)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const result = await createBuzzSecrets(process.argv[2] || '.local/buzz')
    process.stdout.write(`${JSON.stringify(result)}\n`)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not initialize Buzz secrets'
    process.stderr.write(`[buzz-secrets] ${message}\n`)
    process.exitCode = 1
  }
}
