import { spawn } from 'node:child_process'

export type PublishInput = {
  channelId: string
  replyTo?: string
  content: string
}

export type Publisher = (input: PublishInput, signal?: AbortSignal) => Promise<void>

export function createBuzzPublisher(command: string, relayUrl?: string): Publisher {
  return async ({ channelId, replyTo, content }, signal) => {
    const args = ['messages', 'send', '--channel', channelId, '--content', '-']
    if (replyTo) args.push('--reply-to', replyTo)

    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        signal,
        env: relayUrl ? { ...process.env, BUZZ_RELAY_URL: relayUrl } : process.env,
      })
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', (chunk: string) => { if (stderr.length < 4_096) stderr += chunk })
      child.once('error', reject)
      child.once('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Buzz CLI exited with code ${code}: ${stderr.trim().slice(0, 300)}`))
      })
      child.stdin.end(content)
    })
  }
}
