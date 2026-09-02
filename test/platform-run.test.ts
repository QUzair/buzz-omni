import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAgentEnvironment, loadOmnigentAgentIds, renderReleaseSurface, runtimeCatalog } from '../src/platform/platform-run.js'

test('loads the complete Omnigent agent catalog after repeated local restarts', async () => {
  let requested = ''
  const fakeFetch: typeof fetch = async (input) => {
    requested = String(input)
    return Response.json({ data: [
      { id: 'ag_current', name: 'mastercard_release_helper' },
      { id: 'ag_old', name: 'mastercard_release_helper' },
      { id: 'ag_settlement', name: 'mastercard_settlement_support' },
    ] })
  }

  const agents = await loadOmnigentAgentIds(fakeFetch)

  assert.match(requested, /\/v1\/agents\?limit=1000&order=desc$/)
  assert.equal(agents.mastercard_release_helper, 'ag_current')
  assert.equal(agents.mastercard_settlement_support, 'ag_settlement')
})

test('serves real local candidate and stage surfaces for the modeled release', () => {
  const awaiting = { phase: 'awaiting_approval' as const, updatedAt: '2026-09-02T09:20:00Z' }
  const candidate = renderReleaseSurface('/candidates/REL-DEMO-2026-09-02-01', awaiting)
  assert.equal(candidate.status, 200)
  assert.match(candidate.body, /AWAITING HUMAN APPROVAL/)
  assert.match(candidate.body, /Release finish has not run/)

  const gated = renderReleaseSurface('/releases/REL-DEMO-2026-09-02-01', awaiting)
  assert.equal(gated.status, 425)
  assert.match(gated.body, /NOT DEPLOYED/)

  const stage = renderReleaseSurface('/releases/REL-DEMO-2026-09-02-01', {
    phase: 'deployed_to_stage',
    approvalEventId: 'ab'.repeat(32),
    updatedAt: '2026-09-02T09:22:00Z',
  })
  assert.equal(stage.status, 200)
  assert.match(stage.body, /DEPLOYED TO STAGE/)
  assert.match(stage.body, /Production deployment: not run/)

  assert.equal(renderReleaseSurface('/releases/unknown', awaiting).status, 404)
})

test('launches one real Buzz ACP listener for every triage community', () => {
  assert.equal(runtimeCatalog.length, 6)
  assert.equal(new Set(runtimeCatalog.map((agent) => agent.identity)).size, 6)
  assert.equal(new Set(runtimeCatalog.map((agent) => agent.channel)).size, 6)
  assert.ok(runtimeCatalog.every((agent) => agent.allowedEmployees.length >= 2))
})

test('scopes the release handoff to ReleaseHelper and NetworkOps', () => {
  const release = runtimeCatalog.find((agent) => agent.identity === 'release_helper')
  const network = runtimeCatalog.find((agent) => agent.identity === 'network_operations')

  assert.deepEqual(release?.allowedAgents, ['network_operations'])
  assert.deepEqual(network?.allowedAgents, ['release_helper'])
})

test('keeps Buzz identity secrets in process environment and scopes employee steering', () => {
  const runtime = runtimeCatalog[0]!
  const identities = Object.fromEntries([
    'owner', runtime.identity, ...runtime.allowedEmployees, ...runtime.allowedAgents,
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
  assert.equal(env.BUZZ_ACP_RESPOND_TO_ALLOWLIST, [...runtime.allowedEmployees, ...runtime.allowedAgents].map((name) => identities[name]?.publicKey).join(','))
  assert.equal(env.BUZZ_ACP_AGENT_COMMAND, process.execPath)
  assert.equal(env.BUZZ_ACP_AGENT_ARGS, '/app/dist/src/cli.js')
  assert.equal(env.OMNIGENT_AGENT_ID, 'ag_demo')
})

test('allows an enrolled Buzz Desktop member to invoke every remote agent', () => {
  const runtime = runtimeCatalog[0]!
  const identities = Object.fromEntries([
    'owner', runtime.identity, ...runtime.allowedEmployees, ...runtime.allowedAgents,
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
