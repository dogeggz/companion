import type { AgentAdapter, AgentUpdate } from './types.js'

export interface CompanionSource { title: string; url: string; revision: string }

/** POST SSE transport; hosts own authentication, request bodies and endpoints. */
export function createSSEAgent(options: {
  endpoint: string | URL
  body?: (text: string) => unknown
  headers?: HeadersInit
  credentials?: RequestCredentials
  fetch?: typeof fetch
  /** Reference metadata only; hosts choose how to render and navigate links. */
  onSources?: (sources: CompanionSource[]) => void
  /** Opaque host state, committed only when the stream reaches done. */
  onCheckpoint?: (token: string) => void
  /** Inert host metadata (e.g. tool progress); never executes browser actions. */
  onMetadata?: (event: {name: string; data?: unknown}) => void
}): AgentAdapter {
  return async function* ({ text, signal }) {
    const headers = new Headers(options.headers)
    headers.set('Content-Type', 'application/json')
    headers.set('Accept', 'text/event-stream')
    const response = await (options.fetch ?? fetch)(options.endpoint, {
      method: 'POST', headers, credentials: options.credentials ?? 'same-origin',
      body: JSON.stringify(options.body?.(text) ?? { text }), signal,
    })
    if (!response.ok) throw new Error(`Companion request failed (HTTP ${response.status})`)
    if (!response.body || !response.headers.get('content-type')?.includes('text/event-stream')) throw new Error('Expected an SSE response')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let data: string[] = []
    let checkpoint: string | undefined
    const parse = (raw: string): AgentUpdate | 'done' | null => {
      const value = JSON.parse(raw)
      if (value.type === 'state' && typeof value.name === 'string' && value.name.length <= 128) return {type:'state',name:value.name}
      if (value.type === 'metadata') {
        if (typeof value.name !== 'string' || value.name.length > 128) throw new Error('Invalid companion metadata')
        if (!signal.aborted) options.onMetadata?.({name:value.name, data:value.data})
        return null
      }
      if (value.type === 'sources') {
        if (!Array.isArray(value.items) || value.items.length > 12) throw new Error('Invalid companion sources')
        const sources = value.items.map((item: unknown): CompanionSource => {
          if (!item || typeof item !== 'object') throw new Error('Invalid companion source')
          const {title, url, revision} = item as Record<string, unknown>
          if (typeof title !== 'string' || title.length > 300 || typeof url !== 'string' || url.length > 2048 || typeof revision !== 'string' || revision.length > 100) throw new Error('Invalid companion source')
          if (!/^(?:\/(?!\/)|https?:\/\/)/.test(url) || /[\\\s\u0000-\u001f]/.test(url)) throw new Error('Unsafe companion source URL')
          return {title, url, revision}
        })
        if (!signal.aborted) options.onSources?.(sources)
        return null
      }
      if (value.type === 'checkpoint') {
        if (typeof value.token !== 'string' || !value.token.length || value.token.length > 196608) throw new Error('Invalid companion checkpoint')
        checkpoint = value.token
        return null
      }
      if (value.type === 'done') return 'done'
      if (value.type === 'error') throw new Error(typeof value.message === 'string' ? value.message : 'Companion service failed')
      if ((value.type === 'delta' || value.type === 'text') && typeof value.text === 'string') return {type:value.type, text:value.text}
      if (value.type === 'reaction' && typeof value.name === 'string') return {type:'reaction', name:value.name}
      throw new Error('Invalid companion SSE event')
    }
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) throw new Error('Companion stream ended before completion')
        buffer += decoder.decode(chunk.value, {stream:true})
        if (buffer.length + data.join('').length > 262144) throw new Error('Companion SSE event too large')
        let end: number
        while ((end = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0,end).replace(/\r$/, '')
          buffer = buffer.slice(end+1)
          if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''))
          else if (line === '' && data.length) {
            const value = parse(data.join('\n')); data = []
            if (value === 'done') {
              if (!signal.aborted && checkpoint !== undefined) options.onCheckpoint?.(checkpoint)
              return
            }
            if (value) yield value
          }
        }
      }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock() }
  }
}
