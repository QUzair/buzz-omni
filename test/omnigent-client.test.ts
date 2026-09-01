import assert from 'node:assert/strict'
import test from 'node:test'
import { OmnigentClient, parseSse } from '../src/omnigent-client.js'
import type { BridgeConfig } from '../src/config.js'

const config: BridgeConfig = {
  omnigentBaseUrl: 'https://omni.example',
  omnigentAgentId: 'ag_market',
  sandboxProvider: 'daytona',
  buzzCli: 'buzz',
  maxPromptBytes: 1000,
  turnTimeoutMs: 5_000,
}

function sseResponse(frames: object[]): Response {
  const encoded = new TextEncoder().encode(frames.map((frame) => `data: ${JSON.stringify(frame)}\n\n`).join(''))
  return new Response(new ReadableStream({ start(controller) { controller.enqueue(encoded); controller.close() } }), { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
}

test('creates a managed sandbox session with the configured agent', async () => {
  let receivedBody: Record<string, unknown> | undefined
  const fakeFetch: typeof fetch = async (_input, init) => {
    receivedBody = JSON.parse(String(init?.body)) as Record<string, unknown>
    return Response.json({ id: 'ses_123' }, { status: 201 })
  }
  const client = new OmnigentClient(config, fakeFetch)
  assert.equal(await client.createManagedSession('Buzz thread'), 'ses_123')
  assert.deepEqual(receivedBody, { agent_id: 'ag_market', host_type: 'managed', title: 'Buzz thread', sandbox_provider: 'daytona' })
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

test('parses multiline SSE data frames', async () => {
  const bytes = new TextEncoder().encode('event: message\r\ndata: {"type":"response.output_text.delta",\r\ndata: "delta":"hi"}\r\n\r\n')
  const stream = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(bytes); controller.close() } })
  const events = []
  for await (const event of parseSse(stream)) events.push(event)
  assert.deepEqual(events, [{ type: 'response.output_text.delta', delta: 'hi' }])
})
