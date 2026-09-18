import type { CompanionController } from './controller.js'
import type { AgentAdapter } from './types.js'

export interface AgentBindingOptions { thinking?: string; success?: string; error?: string }

/** Host supplies the transport. Latest request wins, even if an adapter ignores abort. */
export function connectAgent(companion: CompanionController, adapter: AgentAdapter, options: AgentBindingOptions = {}) {
  let active: AbortController | undefined
  let generation = 0
  const cancel = () => {
    generation++
    const wasActive = active !== undefined
    active?.abort(); active = undefined
    const snapshot = companion.getSnapshot()
    if (wasActive && snapshot.character && snapshot.reaction === (options.thinking ?? 'thinking')) companion.react(snapshot.character.defaultReaction)
  }
  const reactIfAvailable = (reaction: string) => {
    if (companion.reactions.includes(reaction)) companion.react(reaction)
  }
  const off = companion.on('request', request => {
    cancel()
    const ticket = generation
    const abort = new AbortController()
    active = abort
    const current = () => ticket === generation && !abort.signal.aborted
    reactIfAvailable(options.thinking ?? 'thinking')
    companion.say('')
    void (async () => {
      try {
        for await (const update of adapter({ text: request.text, requestId: request.id, signal: abort.signal })) {
          if (!current()) return
          switch (update.type) {
            case 'text': companion.say(update.text); break
            case 'delta': companion.say(companion.getSnapshot().text + update.text); break
            case 'reaction': companion.react(update.name); break
            case 'action': companion.action(update.name, update.data); break
          }
        }
        if (current()) reactIfAvailable(options.success ?? 'success')
      } catch (error) {
        if (!current()) return
        reactIfAvailable(options.error ?? 'sad')
        companion.reportError('agent', error instanceof Error ? error.message : String(error))
      } finally {
        if (current()) active = undefined
      }
    })()
  })
  const offCharacter = companion.on('characterchange', cancel)
  return {
    cancel,
    disconnect() { cancel(); off(); offCharacter() },
  }
}
