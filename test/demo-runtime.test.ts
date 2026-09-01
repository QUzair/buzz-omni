import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { startRuntimeServer } from '../src/demo/runtime-server.js'

test('serves agent setup and executes a mock triage turn over localhost', async (t) => {
  const server = await startRuntimeServer(0)
  t.after(() => server.close())
  const port = (server.address() as AddressInfo).port

  const agents = await fetch(`http://127.0.0.1:${port}/v1/agents`).then((response) => response.json()) as { agents: unknown[] }
  assert.equal(agents.agents.length, 3)

  const response = await fetch(`http://127.0.0.1:${port}/v1/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Two card charges are not mine' }),
  })
  const result = await response.json() as { route: string, tools: unknown[] }
  assert.equal(response.status, 200)
  assert.equal(result.route, 'fraud-review')
  assert.equal(result.tools.length, 4)
})
