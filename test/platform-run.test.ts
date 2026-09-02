import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAgentEnvironment, runtimeCatalog } from '../src/platform/platform-run.js'

test('launches one real Buzz ACP listener for every triage community', () => {
  assert.equal(runtimeCatalog.length, 5)
  assert.equal(new Set(runtimeCatalog.map((agent) => agent.identity)).size, 5)
  assert.equal(new Set(runtimeCatalog.map((agent) => agent.channel)).size, 5)
  assert.ok(runtimeCatalog.every((agent) => agent.allowedEmployees.length >= 2))
})

test('keeps Buzz identity secrets in process environment and scopes employee steering', () => {
  const runtime = runtimeCatalog[0]!
  const identities = Object.fromEntries([
    'owner', runtime.identity, ...runtime.allowedEmployees,
  ].map((name, index) => [name, { publicKey: `${index + 1}`.repeat(64).slice(0, 64), secretKey: `${index + 6}`.repeat(64).slice(0, 64) }]))
  const env = buildAgentEnvironment(runtime, {
    identities,
    authTag: '["auth","owner","","sig"]',
    omnigentAgentId: 'ag_demo',
    omnigentHostId: '550e8400e29b41d4a716446655440000',
    workspace: '/tmp/demo-workspace',
    bridgePath: '/app/dist/src/cli.js',
  }, {})

  assert.equal(env.BUZZ_PRIVATE_KEY, identities[runtime.identity]?.secretKey)
  assert.equal(env.BUZZ_AUTH_TAG, '["auth","owner","","sig"]')
  assert.equal(env.BUZZ_ACP_RESPOND_TO, 'allowlist')
  assert.equal(env.BUZZ_ACP_RESPOND_TO_ALLOWLIST, runtime.allowedEmployees.map((name) => identities[name]?.publicKey).join(','))
  assert.equal(env.BUZZ_ACP_AGENT_COMMAND, process.execPath)
  assert.equal(env.BUZZ_ACP_AGENT_ARGS, '/app/dist/src/cli.js')
  assert.equal(env.OMNIGENT_AGENT_ID, 'ag_demo')
})

test('allows an enrolled Buzz Desktop member to invoke every remote agent', () => {
  const runtime = runtimeCatalog[0]!
  const identities = Object.fromEntries([
    'owner', runtime.identity, ...runtime.allowedEmployees,
  ].map((name, index) => [name, { publicKey: `${index + 1}`.repeat(64).slice(0, 64), secretKey: `${index + 6}`.repeat(64).slice(0, 64) }]))
  const desktopPublicKey = 'ab'.repeat(32)
  const env = buildAgentEnvironment(runtime, {
    identities,
    authTag: '["auth","owner","","sig"]',
    desktopPublicKey,
    omnigentAgentId: 'ag_demo',
    omnigentHostId: '550e8400e29b41d4a716446655440000',
    workspace: '/tmp/demo-workspace',
    bridgePath: '/app/dist/src/cli.js',
  }, {})

  const allowlist = env.BUZZ_ACP_RESPOND_TO_ALLOWLIST?.split(',') ?? []
  assert.ok(allowlist.includes(desktopPublicKey))
  assert.equal(new Set(allowlist).size, allowlist.length)
})
