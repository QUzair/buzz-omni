import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { TRIAGE_AGENTS, runTriage } from './triage.js'

const json = (response: ServerResponse, status: number, body: unknown): void => {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function readMessage(request: IncomingMessage): Promise<string> {
  let raw = ''
  for await (const chunk of request) {
    raw += String(chunk)
    if (Buffer.byteLength(raw) > 32 * 1024) throw new Error('Request is too large')
  }
  const body = JSON.parse(raw) as unknown
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object')
  const message = (body as Record<string, unknown>).message
  if (typeof message !== 'string' || message.trim().length < 3 || message.length > 2_000) throw new Error('Message must contain 3–2000 characters')
  return message.trim()
}

export async function startRuntimeServer(port = 8009): Promise<Server> {
  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/health') {
        json(response, 200, { status: 'ok', service: 'self-hosted-omnigent-mock', port })
      } else if (request.method === 'GET' && request.url === '/v1/agents') {
        json(response, 200, {
          host: { name: 'masscard-local', sandbox: 'darwin_seatbelt', network: 'blocked', status: 'online' },
          agents: TRIAGE_AGENTS,
        })
      } else if (request.method === 'POST' && request.url === '/v1/triage') {
        json(response, 200, runTriage(await readMessage(request)))
      } else {
        json(response, 404, { error: 'Not found' })
      }
    } catch (error) {
      json(response, 400, { error: error instanceof Error ? error.message : 'Invalid request' })
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return server
}

if (process.argv[1]?.endsWith('runtime-server.js')) {
  const port = Number(process.env.TRIAGE_RUNTIME_PORT || 8009)
  startRuntimeServer(port).then(() => console.log(`[triage-runtime] http://127.0.0.1:${port}`)).catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
