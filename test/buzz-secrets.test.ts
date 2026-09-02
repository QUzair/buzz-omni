import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { createBuzzSecrets, parseBuzzKeypair, renderBuzzEnv } from '../src/platform/buzz-secrets.js'

test('parses buzz-admin key output without accepting malformed keys', () => {
  const publicKey = 'a'.repeat(64)
  const secretKey = 'b'.repeat(64)
  assert.deepEqual(parseBuzzKeypair(`Public key: ${publicKey}\nSecret key: ${secretKey}\n`), { publicKey, secretKey })
  assert.throws(() => parseBuzzKeypair('Public key: nope\nSecret key: nope'), /keypair/)
})

test('renders a closed, loopback Buzz relay configuration', () => {
  const env = renderBuzzEnv({
    ownerPublicKey: 'a'.repeat(64),
    relaySecretKey: 'b'.repeat(64),
    hookSecret: 'c'.repeat(64),
    postgresPassword: 'postgres-secret',
    redisPassword: 'redis-secret',
    s3AccessKey: 'local-access',
    s3SecretKey: 's3-secret',
  })

  assert.match(env, /BUZZ_IMAGE=ghcr\.io\/block\/buzz:sha-1c8321c/)
  assert.match(env, /BUZZ_HTTP_PORT=8010/)
  assert.match(env, /BUZZ_REQUIRE_RELAY_MEMBERSHIP=true/)
  assert.match(env, /RELAY_URL=ws:\/\/127\.0\.0\.1:8010/)
  assert.doesNotMatch(env, /CHANGE_ME/)
})

test('creates private local identity and environment files once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buzz-secrets-test-'))
  let sequence = 1
  const generate = async () => {
    const digit = sequence.toString(16)
    sequence += 1
    return { publicKey: digit.repeat(64), secretKey: digit.repeat(64) }
  }

  const created = await createBuzzSecrets(root, generate, () => 'd'.repeat(64))
  const second = await createBuzzSecrets(root, generate, () => 'e'.repeat(64))

  assert.equal(created.created, true)
  assert.equal(second.created, false)
  assert.equal((await stat(join(root, 'identities.json'))).mode & 0o777, 0o600)
  assert.equal((await stat(join(root, 'buzz.env'))).mode & 0o777, 0o600)
  const state = JSON.parse(await readFile(join(root, 'identities.json'), 'utf8')) as { identities: Record<string, unknown> }
  assert.ok(state.identities.owner)
  assert.ok(state.identities.network_operations)
})

test('adds a release helper identity without rotating existing local keys', async () => {
  const root = await mkdtemp(join(tmpdir(), 'buzz-secrets-migration-test-'))
  let sequence = 1
  const generate = async () => {
    const digit = sequence.toString(16)
    sequence += 1
    return { publicKey: digit.repeat(64), secretKey: digit.repeat(64) }
  }

  await createBuzzSecrets(root, generate, () => 'd'.repeat(64))
  const statePath = join(root, 'identities.json')
  const legacy = JSON.parse(await readFile(statePath, 'utf8')) as {
    identities: Record<string, { publicKey: string; secretKey: string }>
  }
  delete legacy.identities.release_helper
  const existingKeys = structuredClone(legacy.identities)
  await writeFile(statePath, `${JSON.stringify(legacy, null, 2)}\n`, { mode: 0o600 })

  const migrated = await createBuzzSecrets(root, generate, () => 'e'.repeat(64))
  const current = JSON.parse(await readFile(statePath, 'utf8')) as {
    identities: Record<string, { publicKey: string; secretKey: string }>
  }

  assert.equal(migrated.created, false)
  assert.deepEqual(
    Object.fromEntries(Object.entries(current.identities).filter(([name]) => name !== 'release_helper')),
    existingKeys,
  )
  assert.match(current.identities.release_helper?.publicKey ?? '', /^[0-9a-f]{64}$/)
  assert.equal((await stat(statePath)).mode & 0o777, 0o600)
})
