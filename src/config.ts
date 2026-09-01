export type BridgeConfig = {
  omnigentBaseUrl: string
  omnigentAgentId: string
  omnigentHostId: string
  omnigentWorkspace: string
  omnigentApiToken?: string
  buzzCli: string
  maxPromptBytes: number
  turnTimeoutMs: number
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function positiveInteger(raw: string | undefined, fallback: number, name: string): number {
  if (raw === undefined) return fallback
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
  return value
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): BridgeConfig {
  const parsedUrl = new URL(required(env, 'OMNIGENT_BASE_URL'))
  const isLocalHttp = parsedUrl.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)
  if (parsedUrl.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('OMNIGENT_BASE_URL must use HTTPS, except for a local development server')
  }

  const omnigentHostId = required(env, 'OMNIGENT_HOST_ID')
  if (!/^(?:[0-9a-f]{32}|[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i.test(omnigentHostId)) {
    throw new Error('OMNIGENT_HOST_ID must be a UUID')
  }
  const omnigentWorkspace = required(env, 'OMNIGENT_WORKSPACE')
  if (!isAbsolute(omnigentWorkspace)) throw new Error('OMNIGENT_WORKSPACE must be an absolute path on the Omnigent host')

  return {
    omnigentBaseUrl: parsedUrl.toString().replace(/\/$/, ''),
    omnigentAgentId: required(env, 'OMNIGENT_AGENT_ID'),
    omnigentHostId,
    omnigentWorkspace,
    omnigentApiToken: env.OMNIGENT_API_TOKEN?.trim() || readStoredToken(parsedUrl.toString()),
    buzzCli: env.BUZZ_CLI?.trim() || 'buzz',
    maxPromptBytes: positiveInteger(env.BRIDGE_MAX_PROMPT_BYTES, 128 * 1024, 'BRIDGE_MAX_PROMPT_BYTES'),
    turnTimeoutMs: positiveInteger(env.BRIDGE_TURN_TIMEOUT_MS, 15 * 60 * 1000, 'BRIDGE_TURN_TIMEOUT_MS'),
  }
}

function readStoredToken(serverUrl: string): string | undefined {
  try {
    const raw = JSON.parse(readFileSync(join(homedir(), '.omnigent', 'auth_tokens.json'), 'utf8')) as unknown
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
    const records = raw as Record<string, unknown>
    const normalized = serverUrl.replace(/\/$/, '')
    const record = records[normalized]
    if (!record || typeof record !== 'object' || Array.isArray(record)) return undefined
    const fields = record as Record<string, unknown>
    if (typeof fields.expires_at === 'number' && fields.expires_at <= Date.now() / 1000) return undefined
    return typeof fields.token === 'string' && fields.token ? fields.token : undefined
  } catch {
    return undefined
  }
}
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join } from 'node:path'
