export type BuzzRoute = {
  channelId: string
  replyTo?: string
}

const UUID = '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}'
const EVENT_ID = '[0-9a-fA-F]{64}'

export function parseBuzzRoute(prompt: string): BuzzRoute {
  const context = prompt.match(/<context>\s*([\s\S]*?)\s*<\/context>/)?.[1] ?? prompt
  const namedChannel = context.match(new RegExp(`^Channel:\\s+.*\\(#(${UUID})\\)\\s*$`, 'm'))
  const bareChannel = context.match(new RegExp(`^Channel:\\s+(${UUID})\\s*$`, 'm'))
  const channelId = namedChannel?.[1] ?? bareChannel?.[1]
  if (!channelId) throw new Error('Buzz prompt did not include a valid channel UUID')

  const explicitReply = context.match(new RegExp(`--reply-to\\s+(${EVENT_ID})`, 'i'))?.[1]
  return { channelId: channelId.toLowerCase(), replyTo: explicitReply?.toLowerCase() }
}

export function promptText(blocks: unknown, maxBytes: number): string {
  if (!Array.isArray(blocks)) throw new Error('ACP prompt must be an array')
  const text = blocks
    .filter((block): block is { type: string; text: string } => {
      if (!block || typeof block !== 'object') return false
      const item = block as Record<string, unknown>
      return item.type === 'text' && typeof item.text === 'string'
    })
    .map((block) => block.text)
    .join('\n')
    .trim()
  if (!text) throw new Error('ACP prompt contained no text')
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('ACP prompt exceeded the configured size limit')
  return text
}
