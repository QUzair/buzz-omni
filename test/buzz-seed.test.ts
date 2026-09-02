import assert from 'node:assert/strict'
import test from 'node:test'
import {
  agentIdentityNames,
  channelCatalog,
  extractChannelId,
  humanProfiles,
  normalizeDesktopPublicKey,
} from '../src/platform/buzz-seed.js'

test('models distinct private triage communities with real employee steering', () => {
  assert.equal(channelCatalog.length, 5)
  assert.equal(new Set(channelCatalog.map((channel) => channel.name)).size, 5)

  for (const channel of channelCatalog) {
    assert.ok(agentIdentityNames.includes(channel.agent))
    assert.ok(channel.members.length >= 2, `${channel.name} needs multiple employees`)
    assert.ok(channel.members.every((member) => member in humanProfiles))
    assert.ok(channel.messages.length >= 3)
    assert.ok(channel.messages.every((message) => channel.members.includes(message.author)))
    assert.match(channel.description, /synthetic modeled data/i)
  }
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
