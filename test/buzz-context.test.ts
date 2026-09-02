import assert from 'node:assert/strict'
import test from 'node:test'
import { parseBuzzRoute, promptText } from '../src/buzz-context.js'

test('parses the channel UUID and reply anchor from a Buzz ACP prompt', () => {
  const prompt = `<context>
Scope: channel
Channel: merchant-expansion (#550e8400-e29b-41d4-a716-446655440000)
IMPORTANT: use --reply-to aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa on buzz messages send.
</context>`
  assert.deepEqual(parseBuzzRoute(prompt), {
    channelId: '550e8400-e29b-41d4-a716-446655440000',
    replyTo: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  })
})

test('keeps agent-to-agent replies anchored to the trusted Buzz thread root', () => {
  const prompt = `<context>
Scope: thread
Channel: release-control (#550e8400-e29b-41d4-a716-446655440000)
Thread root: bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
</context>
<buzz-event type="@mention">agent handoff</buzz-event>`

  assert.deepEqual(parseBuzzRoute(prompt), {
    channelId: '550e8400-e29b-41d4-a716-446655440000',
    replyTo: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  })
})

test('rejects a prompt without a structurally valid Buzz channel', () => {
  assert.throws(() => parseBuzzRoute('<context>Channel: not-a-channel</context>'), /channel UUID/)
})

test('joins text blocks and enforces the byte limit', () => {
  assert.equal(promptText([{ type: 'text', text: 'one' }, { type: 'image', data: 'ignored' }, { type: 'text', text: 'two' }], 20), 'one\ntwo')
  assert.throws(() => promptText([{ type: 'text', text: 'too large' }], 3), /size limit/)
})
