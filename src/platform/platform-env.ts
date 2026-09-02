import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { normalizeDesktopPublicKey } from './buzz-seed.js'
import { resolveProvider, type ProviderName } from './provider-profiles.js'

export type PlatformOptions = {
  provider: ProviderName
  desktopPublicKey?: string
  openBuzzDesktop: boolean
}

export type LoadedPlatformEnvironment = {
  environment: NodeJS.ProcessEnv
  loaded: boolean
  path: string
}

export function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [index, sourceLine] of content.split(/\r?\n/).entries()) {
    const line = sourceLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
    if (!match) throw new Error(`Invalid environment entry on line ${index + 1}`)
    const [, name, rawValue = ''] = match
    values[name!] = parseEnvValue(rawValue, index + 1)
  }
  return values
}

export async function loadPlatformEnvironment(
  baseEnvironment: NodeJS.ProcessEnv = process.env,
  envPath = resolve('.env'),
): Promise<LoadedPlatformEnvironment> {
  let fileValues: Record<string, string> = {}
  let loaded = false
  try {
    fileValues = parseEnvFile(await readFile(envPath, 'utf8'))
    loaded = true
  } catch (error) {
    if (!isMissingFile(error)) throw error
  }

  const environment: NodeJS.ProcessEnv = { ...fileValues }
  for (const [name, value] of Object.entries(baseEnvironment)) {
    if (value !== undefined) environment[name] = value
  }
  return { environment, loaded, path: envPath }
}

export function readPlatformOptions(environment: NodeJS.ProcessEnv): PlatformOptions {
  const provider = resolveProvider(environment.MODEL_PROVIDER || 'copilot').name
  if (provider === 'gemini' && !environment.GEMINI_API_KEY?.trim()) {
    throw new Error('GEMINI_API_KEY must be set for MODEL_PROVIDER=gemini')
  }
  validatePositiveInteger(environment.BRIDGE_MAX_PROMPT_BYTES, 'BRIDGE_MAX_PROMPT_BYTES')
  validatePositiveInteger(environment.BRIDGE_TURN_TIMEOUT_MS, 'BRIDGE_TURN_TIMEOUT_MS')
  return {
    provider,
    desktopPublicKey: normalizeDesktopPublicKey(environment.BUZZ_DESKTOP_PUBKEY),
    openBuzzDesktop: parseBoolean(environment.OPEN_BUZZ_DESKTOP, true, 'OPEN_BUZZ_DESKTOP'),
  }
}

function parseEnvValue(rawValue: string, line: number): string {
  const value = rawValue.trim()
  if (!value) return ''
  const quote = value[0]
  if (quote === '"' || quote === "'") {
    if (value.length < 2 || value.at(-1) !== quote) {
      throw new Error(`Unterminated quoted environment value on line ${line}`)
    }
    const inner = value.slice(1, -1)
    if (quote === "'") return inner
    return inner.replace(/\\([nrt"\\])/g, (_match, escaped: string) => ({
      n: '\n', r: '\r', t: '\t', '"': '"', '\\': '\\',
    })[escaped]!)
  }
  return value.replace(/\s+#.*$/, '').trimEnd()
}

function parseBoolean(rawValue: string | undefined, fallback: boolean, name: string): boolean {
  if (rawValue === undefined || !rawValue.trim()) return fallback
  const value = rawValue.trim().toLowerCase()
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} must be true or false`)
}

function validatePositiveInteger(rawValue: string | undefined, name: string): void {
  if (rawValue === undefined || !rawValue.trim()) return
  const value = Number(rawValue)
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`)
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}
