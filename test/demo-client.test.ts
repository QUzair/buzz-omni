import assert from 'node:assert/strict'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import { startClientServer } from '../src/demo/client-server.js'
import { startRuntimeServer } from '../src/demo/runtime-server.js'

test('serves the Buzz triage client and proxies only the local mock runtime', async (t) => {
  const runtime = await startRuntimeServer(0)
  t.after(() => runtime.close())
  const runtimePort = (runtime.address() as AddressInfo).port
  const client = await startClientServer(0, `http://127.0.0.1:${runtimePort}`)
  t.after(() => client.close())
  const clientPort = (client.address() as AddressInfo).port

  const page = await fetch(`http://127.0.0.1:${clientPort}/`).then((response) => response.text())
  assert.match(page, /Customer triage/)

  const setup = await fetch(`http://127.0.0.1:${clientPort}/api/setup`).then((response) => response.json()) as { agents: unknown[] }
  assert.equal(setup.agents.length, 3)

  const turn = await fetch(`http://127.0.0.1:${clientPort}/api/triage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'This charge is not mine' }),
  }).then((response) => response.json()) as { route: string }
  assert.equal(turn.route, 'fraud-review')
})
