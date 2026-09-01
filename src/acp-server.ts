import { createInterface } from 'node:readline'
import type { Readable, Writable } from 'node:stream'
import { parseBuzzRoute, promptText } from './buzz-context.js'
import type { BridgeConfig } from './config.js'
import type { Publisher } from './buzz-publisher.js'
import type { OmnigentClient } from './omnigent-client.js'

type RpcRequest = { jsonrpc?: unknown; id?: unknown; method?: unknown; params?: unknown }
type Session = { omnigentId: string; abort?: AbortController; busy: boolean }

export class AcpServer {
  private readonly sessions = new Map<string, Session>()

  constructor(
    private readonly config: BridgeConfig,
    private readonly omnigent: Pick<OmnigentClient, 'createManagedSession' | 'runTurn'>,
    private readonly publish: Publisher,
    private readonly input: Readable = process.stdin,
    private readonly output: Writable = process.stdout,
  ) {}

  run(): void {
    const lines = createInterface({ input: this.input, crlfDelay: Infinity })
    lines.on('line', (line) => {
      if (Buffer.byteLength(line, 'utf8') > this.config.maxPromptBytes * 2) {
        this.writeError(null, -32600, 'JSON-RPC request exceeded the size limit')
        return
      }
      let message: RpcRequest
      try { message = JSON.parse(line) as RpcRequest }
      catch { this.writeError(null, -32700, 'Parse error'); return }
      void this.handle(message)
    })
  }

  private write(payload: object): void {
    this.output.write(`${JSON.stringify(payload)}\n`)
  }

  private writeResult(id: unknown, result: object): void {
    this.write({ jsonrpc: '2.0', id, result })
  }

  private writeError(id: unknown, code: number, message: string): void {
    this.write({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })
  }

  private async handle(request: RpcRequest): Promise<void> {
    const method = typeof request.method === 'string' ? request.method : ''
    const params = request.params && typeof request.params === 'object' ? request.params as Record<string, unknown> : {}

    if (method === 'initialize') {
      this.writeResult(request.id, {
        protocolVersion: 2,
        agentCapabilities: { loadSession: false, promptCapabilities: { image: false, audio: false, embeddedContext: false } },
        agentInfo: { name: 'buzz-omnigent-acp', title: 'MassCard Omnigent', version: '0.1.0' },
      })
      return
    }

    if (method === 'session/new') {
      try {
        const meta = params._meta && typeof params._meta === 'object' ? params._meta as Record<string, unknown> : {}
        const title = typeof meta.sessionTitle === 'string' ? meta.sessionTitle : 'Buzz shared agent session'
        const omnigentId = await this.omnigent.createManagedSession(title)
        this.sessions.set(omnigentId, { omnigentId, busy: false })
        this.writeResult(request.id, { sessionId: omnigentId })
      } catch (error) {
        console.error('[buzz-omnigent-acp] session creation failed:', safeError(error))
        this.writeError(request.id, -32000, 'Could not create the managed Omnigent session')
      }
      return
    }

    if (method === 'session/cancel') {
      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
      this.sessions.get(sessionId)?.abort?.abort()
      return
    }

    if (method === 'session/prompt') {
      const sessionId = typeof params.sessionId === 'string' ? params.sessionId : ''
      const session = this.sessions.get(sessionId)
      if (!session) { this.writeError(request.id, -32602, 'Unknown sessionId'); return }
      if (session.busy) { this.writeError(request.id, -32001, 'A turn is already active for this session'); return }

      let prompt: string
      try { prompt = promptText(params.prompt, this.config.maxPromptBytes) }
      catch (error) { this.writeError(request.id, -32602, safeError(error)); return }

      session.busy = true
      session.abort = new AbortController()
      void this.executeTurn(request.id, session, prompt)
      return
    }

    if (request.id !== undefined) this.writeError(request.id, -32601, `Method not found: ${method || '<missing>'}`)
  }

  private async executeTurn(id: unknown, session: Session, prompt: string): Promise<void> {
    let route: ReturnType<typeof parseBuzzRoute> | undefined
    try {
      route = parseBuzzRoute(prompt)
      const answer = await this.omnigent.runTurn(session.omnigentId, prompt, (delta) => {
        this.write({ jsonrpc: '2.0', method: 'session/update', params: { sessionId: session.omnigentId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: delta } } } })
      }, session.abort?.signal)
      if (!answer) throw new Error('Omnigent completed without response text')
      await this.publish({ ...route, content: answer }, session.abort?.signal)
      this.writeResult(id, { stopReason: 'end_turn' })
    } catch (error) {
      const wasCancelled = session.abort?.signal.aborted === true
      console.error('[buzz-omnigent-acp] turn failed:', safeError(error))
      if (route && !wasCancelled) {
        try { await this.publish({ ...route, content: 'The remote agent could not complete this turn. Check the Omnigent session and sandbox logs, then try again.' }) }
        catch (publishError) { console.error('[buzz-omnigent-acp] failure notice could not be published:', safeError(publishError)) }
      }
      this.writeResult(id, { stopReason: wasCancelled ? 'cancelled' : 'end_turn' })
    } finally {
      session.busy = false
      session.abort = undefined
    }
  }
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Unknown error'
}
