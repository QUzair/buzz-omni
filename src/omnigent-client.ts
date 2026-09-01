import type { BridgeConfig } from './config.js'

type JsonObject = Record<string, unknown>
type DeltaHandler = (text: string) => void

export class OmnigentClient {
  constructor(private readonly config: BridgeConfig, private readonly request: typeof fetch = fetch) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.config.omnigentApiToken ? { Authorization: `Bearer ${this.config.omnigentApiToken}` } : {}),
      ...extra,
    }
  }

  private async expectOk(response: Response, operation: string): Promise<Response> {
    if (response.ok) return response
    await response.body?.cancel()
    throw new Error(`${operation} failed (${response.status})`)
  }

  async createManagedSession(title?: string): Promise<string> {
    const body: JsonObject = { agent_id: this.config.omnigentAgentId, host_type: 'managed' }
    if (title) body.title = title.slice(0, 160)
    if (this.config.sandboxProvider) body.sandbox_provider = this.config.sandboxProvider
    if (this.config.workspaceUrl) body.workspace = this.config.workspaceUrl

    const response = await this.expectOk(await this.request(`${this.config.omnigentBaseUrl}/v1/sessions`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }), 'Create managed session')
    const payload = await response.json() as JsonObject
    const id = [payload.id, payload.session_id, payload.conversation_id].find((value): value is string => typeof value === 'string' && value.length > 0)
    if (!id) throw new Error('Omnigent create-session response did not contain a session id')
    return id
  }

  private async submitMessage(sessionId: string, text: string, signal: AbortSignal): Promise<void> {
    const payload = { type: 'message', data: { role: 'user', content: [{ type: 'input_text', text }] } }
    await this.expectOk(await this.request(`${this.config.omnigentBaseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/events`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(payload),
      signal,
    }), 'Submit Omnigent message')
  }

  async runTurn(sessionId: string, text: string, onDelta: DeltaHandler, parentSignal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(this.config.turnTimeoutMs)
    const signal = parentSignal ? AbortSignal.any([parentSignal, timeout]) : timeout
    const response = await this.expectOk(await this.request(
      `${this.config.omnigentBaseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/stream?idle=false`,
      { headers: this.headers({ Accept: 'text/event-stream' }), signal },
    ), 'Open Omnigent event stream')
    if (!response.body) throw new Error('Omnigent event stream had no response body')

    await this.submitMessage(sessionId, text, signal)
    let answer = ''
    let started = false
    for await (const event of parseSse(response.body)) {
      const type = event.type
      if (type === 'response.output_text.delta' && typeof event.delta === 'string') {
        started = true
        answer += event.delta
        onDelta(event.delta)
      } else if (type === 'response.in_progress' || type === 'turn.started') {
        started = true
      } else if (type === 'response.completed' || type === 'turn.completed') {
        break
      } else if (type === 'response.failed' || type === 'turn.failed' || type === 'response.cancelled' || type === 'turn.cancelled') {
        throw new Error(`Omnigent turn ended with ${String(type)}`)
      } else if (type === 'session.status' && started && (event.status === 'idle' || event.status === 'failed')) {
        if (event.status === 'failed') throw new Error('Omnigent session reported a failed turn')
        break
      }
    }
    return answer.trim()
  }
}

export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<JsonObject> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done }).replace(/\r\n/g, '\n')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = frame.split('\n').filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
        if (data) {
          try {
            const parsed = JSON.parse(data) as unknown
            if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) yield parsed as JsonObject
          } catch { /* malformed server frames are ignored; terminal timeout remains authoritative */ }
        }
        boundary = buffer.indexOf('\n\n')
      }
      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}
