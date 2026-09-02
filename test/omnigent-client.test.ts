import assert from 'node:assert/strict'
import test from 'node:test'
import { OmnigentClient, parseSse } from '../src/omnigent-client.js'
import type { BridgeConfig } from '../src/config.js'

const config: BridgeConfig = {
  omnigentBaseUrl: 'https://omni.example',
  omnigentAgentId: 'ag_market',
  omnigentHostId: '550e8400-e29b-41d4-a716-446655440000',
  omnigentWorkspace: '/srv/omni-agent',
  buzzCli: 'buzz',
  maxPromptBytes: 1000,
  turnTimeoutMs: 5_000,
}

function sseResponse(frames: object[]): Response {
  const encoded = new TextEncoder().encode(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(''))
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoded); controller.close() } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

test('creates a session and starts its runner on the configured self-hosted host', async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const fakeFetch: typeof fetch = async (input, init) => {
    const url = String(input)
    calls.push({ url, body: JSON.parse(String(init?.body)) as Record<string, unknown> })
    if (url.endsWith('/v1/sessions')) return Response.json({ id: 'ses_123' }, { status: 201 })
    return Response.json({ runner_id: 'run_123' }, { status: 201 })
  }
  const client = new OmnigentClient(config, fakeFetch)
  assert.equal(await client.createSession('Buzz thread'), 'ses_123')
  assert.deepEqual(calls[0]?.body, {
    agent_id: 'ag_market',
    initial_items: [],
    title: 'Buzz thread',
  })
  assert.match(calls[1]?.url ?? '', /\/v1\/hosts\/550e8400-e29b-41d4-a716-446655440000\/runners$/)
  assert.deepEqual(calls[1]?.body, { session_id: 'ses_123', workspace: '/srv/omni-agent' })
})

test('does not expose an Omnigent error body in thrown messages', async () => {
  const fakeFetch: typeof fetch = async () => new Response('internal_secret=do-not-log', { status: 500 })
  const client = new OmnigentClient(config, fakeFetch)
  await assert.rejects(client.createSession('Buzz thread'), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.match(error.message, /failed \(500\)/)
    assert.doesNotMatch(error.message, /internal_secret/)
    return true
  })
})

test('streams a turn after opening the SSE connection', async () => {
  const calls: string[] = []
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input)
    calls.push(url)
    if (url.endsWith('/stream?idle=false')) return sseResponse([
      { type: 'response.in_progress' },
      { type: 'response.output_text.delta', delta: 'Hello ' },
      { type: 'response.output_text.delta', delta: 'team' },
      { type: 'response.completed' },
    ])
    return new Response(null, { status: 202 })
  }
  const deltas: string[] = []
  const answer = await new OmnigentClient(config, fakeFetch).runTurn('ses_123', 'question', (delta) => deltas.push(delta))
  assert.equal(answer, 'Hello team')
  assert.deepEqual(deltas, ['Hello ', 'team'])
  assert.match(calls[0] ?? '', /stream/)
  assert.match(calls[1] ?? '', /events/)
})

test('fails immediately when the runner reports failure before output starts', async () => {
  const fakeFetch: typeof fetch = async (input) => {
    if (String(input).endsWith('/stream?idle=false')) return sseResponse([
      { type: 'session.status', status: 'failed' },
    ])
    return new Response(null, { status: 202 })
  }
  const client = new OmnigentClient(config, fakeFetch)
  await assert.rejects(client.runTurn('ses_123', 'question', () => {}), /failed turn/)
})

test('parses multiline SSE data frames', async () => {
  const bytes = new TextEncoder().encode('event: message\r\ndata: {"type":"response.output_text.delta",\r\ndata: "delta":"hi"}\r\n\r\n')
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close() } })
  const events = []
  for await (const event of parseSse(stream)) events.push(event)
  assert.deepEqual(events, [{ type: 'response.output_text.delta', delta: 'hi' }])
})
