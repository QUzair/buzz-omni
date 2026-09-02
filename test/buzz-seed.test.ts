import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentIdentityNames,
  buildAgentAccessAllowlist,
  buildAgentAccessAllowlistForAgent,
  channelCatalog,
  extractChannelId,
  humanMembershipAdditions,
  humanProfiles,
  normalizeDesktopPublicKey,
} from '../src/platform/buzz-seed.js'

test('models distinct private triage communities with real employee steering', () => {
  assert.equal(channelCatalog.length, 6)
  assert.equal(new Set(channelCatalog.map((channel) => channel.name)).size, 6)

  for (const channel of channelCatalog) {
    assert.ok(agentIdentityNames.includes(channel.agent))
    assert.ok(channel.members.length >= 2, `${channel.name} needs multiple employees`)
    assert.ok(channel.members.every((member) => member in humanProfiles))
    assert.ok(channel.messages.length >= 3)
    assert.ok(channel.messages.every((message) => channel.members.includes(message.author)))
    assert.ok((channel.collaboratorAgents ?? []).every((agent) => agentIdentityNames.includes(agent)))
    assert.match(channel.description, /synthetic modeled data/i)
  }

  const release = channelCatalog.find((channel) => channel.name === 'release-control')
  assert.equal(release?.agent, 'release_helper')
  assert.deepEqual(release?.collaboratorAgents, ['network_operations'])
  assert.deepEqual(release ? humanMembershipAdditions(release) : [], ['jon_bell', 'priya_shah'])
})

test('extracts only structurally valid channel UUIDs from Buzz output', () => {
  const id = '550e8400-e29b-41d4-a716-446655440000'
  assert.equal(extractChannelId({ channel: { id } }), id)
  assert.equal(extractChannelId([{ channel_id: id }]), id)
  assert.equal(extractChannelId({ id: 'not-a-uuid' }), undefined)
  assert.equal(extractChannelId({ event_id: 'a'.repeat(64) }), undefined)
})

test('accepts only a canonical Buzz Desktop public key for community enrollment', () => {
  const publicKey = 'AB'.repeat(32)
  assert.equal(normalizeDesktopPublicKey(`  ${publicKey}  `), publicKey.toLowerCase())
  assert.equal(normalizeDesktopPublicKey('  '), undefined)
  assert.throws(() => normalizeDesktopPublicKey('not-a-key'), /64-character hexadecimal/)
})

test('publishes the same explicit remote-agent policy that the listener enforces', () => {
  const identityNames = ['owner', ...Object.keys(humanProfiles), ...agentIdentityNames]
  const identities = Object.fromEntries(identityNames.map((name, index) => [name, {
    publicKey: `${index + 1}`.repeat(64).slice(0, 64),
    secretKey: `${index + 7}`.repeat(64).slice(0, 64),
  }]))
  const desktopPublicKey = 'ab'.repeat(32)

  for (const channel of channelCatalog) {
    assert.deepEqual(
      buildAgentAccessAllowlist(channel, identities, desktopPublicKey),
      [...channel.members.map((name) => identities[name]!.publicKey), desktopPublicKey],
    )
  }
})

test('authorizes the explicit ReleaseHelper and NetworkOps cross-agent handoff', () => {
  const identityNames = ['owner', ...Object.keys(humanProfiles), ...agentIdentityNames]
  const identities = Object.fromEntries(identityNames.map((name, index) => [name, {
    publicKey: `${index + 1}`.repeat(64).slice(0, 64),
    secretKey: `${index + 7}`.repeat(64).slice(0, 64),
  }]))
  const desktopPublicKey = 'ab'.repeat(32)

  const releaseAllowlist = buildAgentAccessAllowlistForAgent(
    'release_helper', channelCatalog, identities, desktopPublicKey,
  )
  const networkAllowlist = buildAgentAccessAllowlistForAgent(
    'network_operations', channelCatalog, identities, desktopPublicKey,
  )

  assert.ok(releaseAllowlist.includes(identities.network_operations!.publicKey))
  assert.ok(networkAllowlist.includes(identities.release_helper!.publicKey))
  assert.ok(releaseAllowlist.includes(desktopPublicKey))
  assert.equal(new Set(releaseAllowlist).size, releaseAllowlist.length)
  assert.equal(new Set(networkAllowlist).size, networkAllowlist.length)
})
