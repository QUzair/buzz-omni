import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import test from 'node:test'
import { setTimeout as delay } from 'node:timers/promises'
import { AcpServer } from '../src/acp-server.js'
import type { PublishInput } from '../src/buzz-publisher.js'
import type { BridgeConfig } from '../src/config.js'

const config: BridgeConfig = { omnigentBaseUrl: 'https://omni.example', omnigentAgentId: 'ag_market', omnigentHostId: '550e8400-e29b-41d4-a716-446655440000', omnigentWorkspace: '/srv/omni-agent', buzzCli: 'buzz', maxPromptBytes: 100_000, turnTimeoutMs: 5_000 }

test('maps ACP session lifecycle to Omnigent and publishes the answer to Buzz', async () => {
  const input = new PassThrough()
  const output = new PassThrough()
  output.setEncoding('utf8')
  let wire = ''
  output.on('data', (chunk: string) => { wire += chunk })
  const published: PublishInput[] = []
  const omnigent = {
    createSession: async () => 'ses_remote',
    runTurn: async (_id: string, _prompt: string, onDelta: (text: string) => void) => { onDelta('sandbox answer'); return 'sandbox answer' },
  }
  new AcpServer(config, omnigent, async (message) => { published.push(message) }, input, output).run()

  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: 2 } })}\n`)
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'session/new', params: { cwd: '/tmp', mcpServers: [] } })}\n`)
  await delay(10)
  const prompt = '<context>\nChannel: lab (#550e8400-e29b-41d4-a716-446655440000)\nIMPORTANT: use --reply-to bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb\n</context>\n<buzz-event>question</buzz-event>'
  input.write(`${JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'session/prompt', params: { sessionId: 'ses_remote', prompt: [{ type: 'text', text: prompt }] } })}\n`)
  await delay(20)

  const messages = wire.trim().split('\n').map((line) => JSON.parse(line) as Record<string, unknown>)
  assert.equal((messages.find((message) => message.id === 1)?.result as Record<string, unknown>).protocolVersion, 2)
  assert.deepEqual(messages.find((message) => message.id === 2)?.result, { sessionId: 'ses_remote' })
  assert.deepEqual(messages.find((message) => message.id === 3)?.result, { stopReason: 'end_turn' })
  assert.deepEqual(published, [{ channelId: '550e8400-e29b-41d4-a716-446655440000', replyTo: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', content: 'sandbox answer' }])
  input.end()
})
