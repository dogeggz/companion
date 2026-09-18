import { createCompanion, CompanionController } from './controller.js'
import { loadCharacter, sampleReaction } from './character.js'
import type { CharacterPack, CompanionCommand, CompanionEvents, CompanionSnapshot, SpritePose } from './types.js'

export interface CompanionElement extends HTMLElement {
  controller: CompanionController
  character: CharacterPack | null
  react(name: string): boolean
  say(text: string): void
  ask(text: string): void
  send(command: CompanionCommand): boolean | void
}
const eventNames: (keyof CompanionEvents)[] = ['statechange', 'characterchange', 'message', 'request', 'action', 'complete', 'error']
const css = `
  :host{display:inline-flex;flex-direction:column;align-items:center;vertical-align:middle;width:var(--companion-size,144px);font:14px/1.6 system-ui,sans-serif;color:var(--companion-color,#445549)}
  :host([hidden]){display:none}
  *{box-sizing:border-box}
  button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:pointer;border-radius:20%;line-height:0;color:inherit}
  button:focus-visible{outline:2px solid var(--companion-accent,#739c8d);outline-offset:3px}
  canvas{display:block;width:100%;height:auto;aspect-ratio:1}
  .message{margin:0 0 8px;padding:9px 13px;background:var(--companion-bubble,#fffdf7);border:1px solid var(--companion-border,#dce3d8);border-radius:14px 14px 14px 3px;max-width:var(--companion-message-width,280px);min-width:100%;width:max-content;overflow-wrap:anywhere;white-space:pre-wrap;font-size:var(--companion-font-size,12px);line-height:1.7}
  .message[hidden]{display:none}
  slot{display:contents}
`

/** Register lazily: importing the package in SSR/Node never touches HTMLElement. */
export function defineCompanion(tagName = 'agent-companion'): CustomElementConstructor | undefined {
  if (typeof globalThis.customElements === 'undefined') return undefined
  const existing = customElements.get(tagName)
  if (existing) return existing

  class AgentCompanionElement extends HTMLElement implements CompanionElement {
    static observedAttributes = ['character-src', 'label', 'size', 'reaction', 'paused']
    private model = createCompanion()
    private stops: (() => void)[] = []
    private canvas: HTMLCanvasElement
    private bubble: HTMLParagraphElement
    private button: HTMLButtonElement
    private media: MediaQueryList | undefined
    private raf = 0
    private elapsed = 0
    private lastTime: number | undefined
    private previousPlay = -1
    private previousPack: CharacterPack | null = null
    private painted = ''
    private images = new Map<string, HTMLImageElement>()
    private ready = false
    private imageGeneration = 0
    private loading: AbortController | undefined
    private sourceGeneration = 0

    constructor() {
      super()
      const shadow = this.attachShadow({ mode: 'open' })
      const style = document.createElement('style'); style.textContent = css
      this.bubble = document.createElement('p')
      this.bubble.className = 'message'; this.bubble.part.add('message'); this.bubble.hidden = true
      this.bubble.setAttribute('role', 'status'); this.bubble.setAttribute('aria-live', 'polite')
      this.button = document.createElement('button'); this.button.type = 'button'; this.button.part.add('avatar')
      this.canvas = document.createElement('canvas'); this.canvas.width = 256; this.canvas.height = 256
      this.canvas.setAttribute('aria-hidden', 'true'); this.canvas.part.add('canvas')
      this.button.append(this.canvas)
      this.button.addEventListener('click', () => this.model.action('tap'))
      const slot = document.createElement('slot')
      shadow.append(style, this.bubble, this.button, slot)
    }

    get controller() { return this.model }
    set controller(value: CompanionController) {
      if (value === this.model) return
      if (!value || typeof value.getSnapshot !== 'function') throw new TypeError('Expected a companion controller')
      this.cancelLoad()
      this.unbind(); this.model = value
      this.previousPlay = -1; this.previousPack = null
      if (this.isConnected) this.bind()
    }
    get character() { return this.model.getSnapshot().character }
    set character(value: CharacterPack | null) {
      this.cancelLoad()
      if (value) this.model.setCharacter(value)
      else this.model.clearCharacter()
    }
    react(name: string) { return this.model.react(name) }
    say(text: string) { this.model.say(text) }
    ask(text: string) { this.model.ask(text) }
    send(command: CompanionCommand) { return this.model.send(command) }

    connectedCallback() {
      // Preserve properties assigned before customElements.define upgraded this element.
      for (const key of ['controller', 'character'] as const) {
        if (Object.hasOwn(this, key)) {
          const value = this[key]
          delete (this as unknown as Record<string, unknown>)[key]
          if (key === 'controller') this.controller = value as CompanionController
          else this.character = value as CharacterPack | null
        }
      }
      this.media = window.matchMedia('(prefers-reduced-motion: reduce)')
      this.media.addEventListener('change', this.sync)
      document.addEventListener('visibilitychange', this.sync)
      this.bind()
      this.applyPresentation()
      if (this.hasAttribute('paused')) this.model.pause()
      if (this.hasAttribute('character-src')) void this.readSource()
      else this.applyReaction()
    }
    disconnectedCallback() {
      this.unbind(); this.cancelLoad(); this.imageGeneration++
      this.media?.removeEventListener('change', this.sync)
      document.removeEventListener('visibilitychange', this.sync)
      this.previousPack = null; this.ready = false
    }
    attributeChangedCallback(name: string, old: string | null, value: string | null) {
      if (old === value) return
      if (name === 'size' && value === null) this.style.removeProperty('--companion-size')
      if (name === 'label' || name === 'size') this.applyPresentation()
      if (!this.isConnected) return
      if (name === 'character-src') void this.readSource()
      if (name === 'reaction') this.applyReaction()
      if (name === 'paused') this.hasAttribute('paused') ? this.model.pause() : this.model.resume()
    }
    private bind() {
      this.unbind()
      this.stops = [this.model.subscribe(this.sync)]
      for (const name of eventNames) this.stops.push(this.model.on(name, detail => {
        this.dispatchEvent(new CustomEvent(`companion-${name}`, { detail, bubbles: true, composed: true }))
      }))
      this.sync()
    }
    private unbind() {
      this.stops.forEach(stop => stop()); this.stops = []
      cancelAnimationFrame(this.raf); this.lastTime = undefined
    }
    private cancelLoad() { this.sourceGeneration++; this.loading?.abort(); this.loading = undefined }
    private async readSource() {
      this.cancelLoad()
      const src = this.getAttribute('character-src')
      if (!src) return
      const ticket = this.sourceGeneration
      const abort = new AbortController(); this.loading = abort
      try {
        const character = await loadCharacter(new URL(src, this.baseURI), { signal: abort.signal })
        if (ticket !== this.sourceGeneration || !this.isConnected) return
        this.model.setCharacter(character); this.applyReaction()
      } catch (error) {
        if (!abort.signal.aborted && ticket === this.sourceGeneration) this.model.reportError('character-load', String(error))
      }
    }
    private applyReaction() {
      const reaction = this.getAttribute('reaction')
      if (reaction && this.character) this.model.react(reaction)
    }
    private applyPresentation() {
      const size = Number(this.getAttribute('size'))
      if (size > 0 && Number.isFinite(size)) this.style.setProperty('--companion-size', `${size}px`)
      this.button.setAttribute('aria-label', this.getAttribute('label') ?? this.character?.name ?? 'Companion')
    }
    private async prepare(pack: CharacterPack) {
      const ticket = ++this.imageGeneration
      this.ready = false; this.images.clear(); this.painted = ''
      this.canvas.width = pack.size.width; this.canvas.height = pack.size.height
      this.canvas.style.aspectRatio = `${pack.size.width} / ${pack.size.height}`
      try {
        const loaded = await Promise.all(Object.entries(pack.assets).map(async ([key, asset]) => {
          const image = new Image(); image.src = new URL(asset.src, this.baseURI).href
          await image.decode()
          if (image.naturalWidth !== asset.width || image.naturalHeight !== asset.height) throw new Error(`Asset ${key} dimensions differ from manifest`)
          return [key, image] as const
        }))
        if (ticket !== this.imageGeneration || !this.isConnected) return
        this.images = new Map(loaded); this.ready = true
        this.sync()
      } catch (error) {
        if (ticket === this.imageGeneration && this.isConnected) this.model.reportError('asset-load', String(error))
      }
    }
    private draw(pose: SpritePose, key: string) {
      if (this.painted === key) return
      const image = this.images.get(pose.asset)
      const ctx = this.canvas.getContext('2d')
      if (!image || !ctx) return
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
      const r = pose.rect ?? [0, 0, image.naturalWidth, image.naturalHeight]
      ctx.drawImage(image, r[0], r[1], r[2], r[3], 0, 0, this.canvas.width, this.canvas.height)
      this.painted = key
    }
    private render(snapshot: CompanionSnapshot) {
      const pack = snapshot.character
      const clip = snapshot.reaction && pack?.reactions[snapshot.reaction]
      if (!pack || !this.ready) return
      if (!clip) { this.draw(pack.base, 'base'); return }
      const sample = sampleReaction(clip, this.elapsed, snapshot.loop)
      const index = this.media?.matches ? clip.poster ?? 0 : sample.index
      this.draw(clip.frames[index], `${snapshot.playId}:${index}`)
      this.dataset.frame = String(index)
      this.dataset.reaction = snapshot.reaction!
    }
    private sync = () => {
      cancelAnimationFrame(this.raf)
      const snapshot = this.model.getSnapshot()
      if (this.bubble.textContent !== snapshot.text) this.bubble.textContent = snapshot.text
      this.bubble.hidden = !snapshot.text
      this.applyPresentation()
      if (snapshot.playId !== this.previousPlay) {
        this.previousPlay = snapshot.playId; this.elapsed = 0; this.painted = ''; this.lastTime = undefined
      }
      if (snapshot.character !== this.previousPack) {
        this.previousPack = snapshot.character
        if (snapshot.character) void this.prepare(snapshot.character)
        else {
          this.imageGeneration++; this.ready = false; this.images.clear()
          this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height)
        }
      }
      this.render(snapshot)
      if (this.ready && !snapshot.paused && !document.hidden && !(this.media?.matches && snapshot.loop)) this.raf = requestAnimationFrame(this.tick)
      else this.lastTime = undefined
    }
    private tick = (now: number) => {
      const snapshot = this.model.getSnapshot()
      const clip = snapshot.reaction && snapshot.character?.reactions[snapshot.reaction]
      if (!clip || !this.ready || snapshot.paused || document.hidden) return
      if (this.lastTime !== undefined) this.elapsed += now - this.lastTime
      this.lastTime = now
      this.render(snapshot)
      if (sampleReaction(clip, this.elapsed, snapshot.loop).done) {
        this.model.finish(snapshot.playId, this.media?.matches ?? false)
        return
      }
      this.raf = requestAnimationFrame(this.tick)
    }
  }
  customElements.define(tagName, AgentCompanionElement)
  return AgentCompanionElement
}

declare global {
  interface HTMLElementTagNameMap { 'agent-companion': CompanionElement }
}
