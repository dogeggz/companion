import type { CompanionController } from './controller.js'
import type { AgentAdapter } from './types.js'

export interface AgentBindingOptions { thinking?: string; success?: string; error?: string; states?: Record<string, string>; transientStates?: readonly string[]; transientReactions?: readonly string[] }

/** Host supplies the transport. Latest request wins, even if an adapter ignores abort. */
export function connectAgent(companion: CompanionController, adapter: AgentAdapter, options: AgentBindingOptions = {}) {
  let active: AbortController | undefined
  let generation = 0
  let progressPlayId: number | undefined
  const transientStates = new Set(options.transientStates ?? ['thinking', 'tool_running'])
  const transientReactions = new Set(options.transientReactions ?? [options.thinking ?? 'thinking'])
  const cancel = () => {
    generation++
    const wasActive = active !== undefined
    active?.abort(); active = undefined
    const snapshot = companion.getSnapshot()
    if (wasActive && snapshot.character && snapshot.playId === progressPlayId) companion.react(snapshot.character.defaultReaction)
    progressPlayId = undefined
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
    progressPlayId = companion.getSnapshot().playId
    companion.say('')
    void (async () => {
      let completionReaction: string | undefined
      let showingProgress = true
      const present = (reaction: string, transient: boolean) => {
        if (!companion.reactions.includes(reaction)) return
        companion.react(reaction)
        showingProgress = transient
        progressPlayId = transient ? companion.getSnapshot().playId : undefined
        if (!transient) completionReaction = reaction
      }
      try {
        for await (const update of adapter({ text: request.text, requestId: request.id, signal: abort.signal })) {
          if (!current()) return
          switch (update.type) {
            case 'state': {
              const reaction = options.states?.[update.name]
              if (reaction) present(reaction, transientStates.has(update.name) || transientReactions.has(reaction))
              break
            }
            case 'text': companion.say(update.text); break
            case 'delta': companion.say(companion.getSnapshot().text + update.text); break
            case 'reaction':
              present(update.name, transientReactions.has(update.name))
              break
            case 'action': companion.action(update.name, update.data); break
          }
        }
        // A later model/tool round may temporarily cover an explicit emotion.
        // Settle only progress owned by this request, never a newer host animation.
        if (current() && showingProgress && companion.getSnapshot().playId === progressPlayId) {
          const fallback = options.success ?? 'success'
          reactIfAvailable(completionReaction ?? (companion.reactions.includes(fallback) ? fallback : companion.getSnapshot().character?.defaultReaction ?? 'idle'))
        }
      } catch (error) {
        if (!current()) return
        reactIfAvailable(options.error ?? 'sad')
        companion.reportError('agent', error instanceof Error ? error.message : String(error))
      } finally {
        if (current()) { active = undefined; progressPlayId = undefined }
      }
    })()
  })
  const offCharacter = companion.on('characterchange', cancel)
  return {
    cancel,
    disconnect() { cancel(); off(); offCharacter() },
  }
}
