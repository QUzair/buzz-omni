import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { join } from 'node:path'

const assets: Record<string, { file: string, type: string }> = {
  '/': { file: 'index.html', type: 'text/html; charset=utf-8' },
  '/app.js': { file: 'app.js', type: 'text/javascript; charset=utf-8' },
  '/styles.css': { file: 'styles.css', type: 'text/css; charset=utf-8' },
}

const securityHeaders = {
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; img-src 'self' data:; font-src 'self'",
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
}

const pipeRuntime = async (request: IncomingMessage, response: ServerResponse, runtimeUrl: string): Promise<void> => {
  const path = request.url === '/api/setup'
    ? '/v1/agents'
    : request.url === '/api/workspace'
      ? '/v1/workspace'
      : request.url?.startsWith('/api/workflows/')
        ? `/v1/workflows/${encodeURIComponent(decodeURIComponent(request.url.slice('/api/workflows/'.length)))}`
        : '/v1/triage'
  const body = request.method === 'POST' ? await readBody(request) : undefined
  const upstream = await fetch(`${runtimeUrl}${path}`, {
    method: request.method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body,
  })
  response.writeHead(upstream.status, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' })
  response.end(await upstream.text())
}

async function readBody(request: IncomingMessage): Promise<string> {
  let body = ''
  for await (const chunk of request) {
    body += String(chunk)
    if (Buffer.byteLength(body) > 32 * 1024) throw new Error('Request is too large')
  }
  return body
}

export async function startClientServer(port = 8008, runtimeUrl = 'http://127.0.0.1:8009'): Promise<Server> {
  const uiDirectory = join(process.cwd(), 'demo')
  const server = createServer(async (request, response) => {
    try {
      if (request.method === 'GET' && request.url === '/api/setup') {
        await pipeRuntime(request, response, runtimeUrl)
        return
      }
      if (request.method === 'GET' && request.url === '/api/workspace') {
        await pipeRuntime(request, response, runtimeUrl)
        return
      }
      if (request.method === 'POST' && request.url === '/api/triage') {
        await pipeRuntime(request, response, runtimeUrl)
        return
      }
      if (request.method === 'POST' && request.url?.startsWith('/api/workflows/')) {
        await pipeRuntime(request, response, runtimeUrl)
        return
      }
      const asset = request.method === 'GET' ? assets[request.url?.split('?')[0] || '/'] : undefined
      if (!asset) {
        response.writeHead(404, { ...securityHeaders, 'Content-Type': 'text/plain; charset=utf-8' })
        response.end('Not found')
        return
      }
      response.writeHead(200, { ...securityHeaders, 'Content-Type': asset.type })
      response.end(await readFile(join(uiDirectory, asset.file)))
    } catch (error) {
      response.writeHead(502, { ...securityHeaders, 'Content-Type': 'application/json; charset=utf-8' })
      response.end(JSON.stringify({ error: error instanceof Error ? error.message : 'Local runtime unavailable' }))
    }
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  return server
}
