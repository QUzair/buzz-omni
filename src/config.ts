export type BridgeConfig = {
  omnigentBaseUrl: string
  omnigentAgentId: string
  omnigentApiToken?: string
  sandboxProvider?: string
  workspaceUrl?: string
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

  return {
    omnigentBaseUrl: parsedUrl.toString().replace(/\/$/, ''),
    omnigentAgentId: required(env, 'OMNIGENT_AGENT_ID'),
    omnigentApiToken: env.OMNIGENT_API_TOKEN?.trim() || undefined,
    sandboxProvider: env.OMNIGENT_SANDBOX_PROVIDER?.trim() || undefined,
    workspaceUrl: env.OMNIGENT_WORKSPACE_URL?.trim() || undefined,
    buzzCli: env.BUZZ_CLI?.trim() || 'buzz',
    maxPromptBytes: positiveInteger(env.BRIDGE_MAX_PROMPT_BYTES, 128 * 1024, 'BRIDGE_MAX_PROMPT_BYTES'),
    turnTimeoutMs: positiveInteger(env.BRIDGE_TURN_TIMEOUT_MS, 15 * 60 * 1000, 'BRIDGE_TURN_TIMEOUT_MS'),
  }
}
