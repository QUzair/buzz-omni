import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import {
  loadPlatformEnvironment,
  parseEnvFile,
  readPlatformOptions,
} from '../src/platform/platform-env.js'

test('parses the documented env-file syntax without treating comments as values', () => {
  assert.deepEqual(parseEnvFile([
    '# local platform configuration',
    'MODEL_PROVIDER=copilot',
    'OPEN_BUZZ_DESKTOP="true"',
    "BUZZ_DESKTOP_PUBKEY='ab12'",
    'EMPTY=',
    '',
  ].join('\n')), {
    MODEL_PROVIDER: 'copilot',
    OPEN_BUZZ_DESKTOP: 'true',
    BUZZ_DESKTOP_PUBKEY: 'ab12',
    EMPTY: '',
  })
})

test('rejects malformed env-file entries instead of silently ignoring configuration', () => {
  assert.throws(() => parseEnvFile('MODEL-PROVIDER=copilot'), /line 1/)
  assert.throws(() => parseEnvFile('MODEL_PROVIDER="copilot'), /line 1/)
})

test('loads .env values while preserving explicit shell overrides', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'buzz-platform-env-'))
  const path = join(directory, '.env')
  try {
    await writeFile(path, 'MODEL_PROVIDER=gemini\nOPEN_BUZZ_DESKTOP=false\n', 'utf8')
    const loaded = await loadPlatformEnvironment({ MODEL_PROVIDER: 'copilot' }, path)

    assert.equal(loaded.loaded, true)
    assert.equal(loaded.environment.MODEL_PROVIDER, 'copilot')
    assert.equal(loaded.environment.OPEN_BUZZ_DESKTOP, 'false')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('validates provider credentials, desktop enrollment, and launch behavior', () => {
  const publicKey = 'ab'.repeat(32)
  assert.deepEqual(readPlatformOptions({
    MODEL_PROVIDER: 'copilot',
    BUZZ_DESKTOP_PUBKEY: publicKey.toUpperCase(),
    OPEN_BUZZ_DESKTOP: 'false',
  }), {
    provider: 'copilot',
    desktopPublicKey: publicKey,
    openBuzzDesktop: false,
  })

  assert.throws(() => readPlatformOptions({ MODEL_PROVIDER: 'gemini' }), /GEMINI_API_KEY/)
  assert.throws(() => readPlatformOptions({ OPEN_BUZZ_DESKTOP: 'sometimes' }), /OPEN_BUZZ_DESKTOP/)
})
