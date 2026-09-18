import { defineCharacter } from './character.js'
import type { CharacterPack, CompanionCommand, CompanionEvents, CompanionSnapshot, ReactOptions } from './types.js'

type Listener<K extends keyof CompanionEvents> = (detail: CompanionEvents[K]) => void

/** Framework- and DOM-independent state and communication. */
export class CompanionController {
  private snapshot: CompanionSnapshot = Object.freeze({ character: null, reaction: null, text: '', paused: false, playId: 0, loop: false, returnTo: null })
  private subscribers = new Set<(snapshot: CompanionSnapshot) => void>()
  private events = new Map<keyof CompanionEvents, Set<(detail: never) => void>>()
  private requestId = 0
  private completed = -1

  constructor(character?: CharacterPack) { if (character) this.setCharacter(character) }
  getSnapshot = () => this.snapshot
  subscribe = (listener: (snapshot: CompanionSnapshot) => void) => {
    this.subscribers.add(listener)
    return () => { this.subscribers.delete(listener) }
  }
  on<K extends keyof CompanionEvents>(type: K, listener: Listener<K>): () => void {
    let listeners = this.events.get(type)
    if (!listeners) this.events.set(type, listeners = new Set())
    listeners.add(listener as (detail: never) => void)
    return () => { listeners.delete(listener as (detail: never) => void) }
  }
  private emit<K extends keyof CompanionEvents>(type: K, detail: CompanionEvents[K]) {
    this.events.get(type)?.forEach(listener => listener(detail as never))
  }
  private update(patch: Partial<CompanionSnapshot>) {
    this.snapshot = Object.freeze({ ...this.snapshot, ...patch })
    this.subscribers.forEach(listener => listener(this.snapshot))
  }
  setCharacter(character: CharacterPack) {
    const pack = defineCharacter(character)
    const clip = pack.reactions[pack.defaultReaction]
    this.update({ character: pack, reaction: pack.defaultReaction, text: '', playId: this.snapshot.playId + 1, loop: clip.loop ?? false, returnTo: clip.returnTo ?? null })
    this.emit('characterchange', { character: pack })
  }
  clearCharacter() {
    this.update({ character: null, reaction: null, text: '', playId: this.snapshot.playId + 1, loop: false, returnTo: null })
  }
  get reactions(): string[] { return Object.keys(this.snapshot.character?.reactions ?? {}) }
  react(reaction: string, options: ReactOptions = {}): boolean {
    const pack = this.snapshot.character
    if (!pack || !Object.hasOwn(pack.reactions, reaction)) {
      this.reportError('unknown-reaction', `Unknown reaction: ${reaction}`)
      return false
    }
    const clip = pack.reactions[reaction]
    const returnTo = options.returnTo !== undefined ? options.returnTo : clip.returnTo !== undefined ? clip.returnTo : pack.defaultReaction
    if (returnTo !== null && !Object.hasOwn(pack.reactions, returnTo)) {
      this.reportError('unknown-reaction', `Unknown returnTo: ${returnTo}`)
      return false
    }
    this.update({ reaction, loop: options.loop ?? clip.loop ?? false, returnTo, playId: this.snapshot.playId + 1 })
    this.emit('statechange', { reaction, playId: this.snapshot.playId })
    return true
  }
  say(text: string) { this.update({ text }); this.emit('message', { text }) }
  ask(text: string) { if (text.trim()) this.emit('request', { text, id: ++this.requestId }) }
  action(name: string, data?: unknown) { this.emit('action', { name, data }) }
  pause() { this.update({ paused: true }) }
  resume() { this.update({ paused: false }) }
  reportError(code: string, message: string) { this.emit('error', { code, message }) }
  send(command: CompanionCommand) {
    switch (command.type) {
      case 'react': return this.react(command.reaction, command)
      case 'say': this.say(command.text); break
      case 'ask': this.ask(command.text); break
      case 'action': this.action(command.name, command.data); break
      case 'pause': this.pause(); break
      case 'resume': this.resume(); break
      case 'clear': this.say(''); break
    }
  }
  /** Called by the renderer. A stale completion cannot overwrite a newer reaction. */
  finish(playId: number, reducedMotion = false) {
    const snapshot = this.snapshot
    if (snapshot.playId !== playId || this.completed === playId || snapshot.loop || !snapshot.reaction) return
    this.completed = playId
    this.emit('complete', { reaction: snapshot.reaction, playId, reducedMotion })
    if (this.snapshot.playId === playId && snapshot.returnTo && snapshot.returnTo !== snapshot.reaction) this.react(snapshot.returnTo)
  }
}

export function createCompanion(character?: CharacterPack) { return new CompanionController(character) }
