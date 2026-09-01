import { startClientServer } from './client-server.js'
import { startRuntimeServer } from './runtime-server.js'

const clientPort = Number(process.env.TRIAGE_CLIENT_PORT || 8008)
const runtimePort = Number(process.env.TRIAGE_RUNTIME_PORT || 8009)
const runtime = await startRuntimeServer(runtimePort)
const client = await startClientServer(clientPort, `http://127.0.0.1:${runtimePort}`)

console.log(`[triage-demo] Buzz client     http://127.0.0.1:${clientPort}/?demo=1`)
console.log(`[triage-demo] Omnigent mock  http://127.0.0.1:${runtimePort}`)

const stop = (): void => {
  client.close()
  runtime.close()
}
process.once('SIGINT', stop)
process.once('SIGTERM', stop)
