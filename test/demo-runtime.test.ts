import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { startRuntimeServer } from '../src/demo/runtime-server.js'

test('serves agent setup and executes a mock triage turn over localhost', async (t) => {
  const server = await startRuntimeServer(0)
  t.after(() => server.close())
  const port = (server.address() as AddressInfo).port

  const agents = await fetch(`http://127.0.0.1:${port}/v1/agents`).then((response) => response.json()) as { agents: unknown[] }
  assert.equal(agents.agents.length, 7)

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

test('serves the modeled Mastercard workspace and channel workflows', async (t) => {
  const server = await startRuntimeServer(0)
  t.after(() => server.close())
  const port = (server.address() as AddressInfo).port

  const workspace = await fetch(`http://127.0.0.1:${port}/v1/workspace`).then((response) => response.json()) as { channels: unknown[] }
  assert.equal(workspace.channels.length, 5)

  const response = await fetch(`http://127.0.0.1:${port}/v1/workflows/network-operations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: '@NetworkOps diagnose the authorization dip' }),
  })
  const result = await response.json() as { agent: string, tools: unknown[] }
  assert.equal(response.status, 200)
  assert.equal(result.agent, 'Network Operations')
  assert.equal(result.tools.length >= 3, true)
})
