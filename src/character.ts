import type { CharacterPack, Reaction, SpritePose } from './types.js'

function object(value: unknown, name: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${name} must be an object`)
}
function positive(value: unknown, name: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) throw new TypeError(`${name} must be a positive finite number`)
}
function nonempty(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${name} must be a non-empty string`)
}
function own(value: object, key: string) { return Object.hasOwn(value, key) }

/** Validate user supplied JSON and return an isolated, URL-resolved copy. */
export function defineCharacter(input: unknown, baseUrl?: string | URL): CharacterPack {
  object(input, 'character')
  const pack = structuredClone(input) as unknown as CharacterPack
  if (pack.schemaVersion !== 1) throw new TypeError('Unsupported character schemaVersion')
  nonempty(pack.id, 'id'); nonempty(pack.name, 'name')
  object(pack.size, 'size'); positive(pack.size.width, 'size.width'); positive(pack.size.height, 'size.height')
  object(pack.assets, 'assets'); object(pack.reactions, 'reactions')
  for (const [key, asset] of Object.entries(pack.assets)) {
    object(asset, `assets.${key}`); nonempty(asset.src, `${key}.src`)
    positive(asset.width, `${key}.width`); positive(asset.height, `${key}.height`)
    if (baseUrl) asset.src = new URL(asset.src, baseUrl).href
  }
  const pose = (value: unknown, label: string) => {
    object(value, label)
    const p = value as unknown as SpritePose
    if (typeof p.asset !== 'string' || !own(pack.assets, p.asset)) throw new TypeError(`${label}: unknown asset`)
    if (p.rect !== undefined) {
      const a = pack.assets[p.asset]
      const r = p.rect
      if (!Array.isArray(r) || r.length !== 4 || r.some(n => typeof n !== 'number' || !Number.isFinite(n)) || r[0] < 0 || r[1] < 0 || r[2] <= 0 || r[3] <= 0 || r[0] + r[2] > a.width || r[1] + r[3] > a.height) throw new TypeError(`${label}: rect outside asset bounds`)
    }
  }
  pose(pack.base, 'base')
  nonempty(pack.defaultReaction, 'defaultReaction')
  if (!own(pack.reactions, pack.defaultReaction)) throw new TypeError('defaultReaction must exist')
  for (const [name, clip] of Object.entries(pack.reactions)) {
    nonempty(name, 'reaction name'); object(clip, `reactions.${name}`)
    if (!Array.isArray(clip.frames) || !clip.frames.length) throw new TypeError(`${name}: frames must not be empty`)
    clip.frames.forEach((frame, i) => { pose(frame, `${name}[${i}]`); positive(frame.duration, `${name}[${i}].duration`) })
    if (clip.loop !== undefined && typeof clip.loop !== 'boolean') throw new TypeError(`${name}: loop must be boolean`)
    if (clip.poster !== undefined && (!Number.isInteger(clip.poster) || clip.poster < 0 || clip.poster >= clip.frames.length)) throw new TypeError(`${name}: poster outside frames`)
    if (clip.returnTo !== undefined && clip.returnTo !== null && (typeof clip.returnTo !== 'string' || !own(pack.reactions, clip.returnTo))) throw new TypeError(`${name}: unknown returnTo`)
  }
  return deepFreeze(pack)
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze)
    Object.freeze(value)
  }
  return value
}

export async function loadCharacter(url: string | URL, options: { signal?: AbortSignal } = {}): Promise<CharacterPack> {
  const response = await fetch(url, { signal: options.signal })
  if (!response.ok) throw new Error(`Character request failed: ${response.status}`)
  return defineCharacter(await response.json(), response.url || url)
}

/** Frame durations are milliseconds; never assume a particular grid or frame count. */
export function sampleReaction(clip: Reaction, elapsed: number, loop = clip.loop ?? false) {
  const duration = clip.frames.reduce((sum, frame) => sum + frame.duration, 0)
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0
  let remaining = loop ? time % duration : time
  let index = 0
  while (index < clip.frames.length - 1 && remaining >= clip.frames[index].duration) {
    remaining -= clip.frames[index].duration
    index++
  }
  return { index, done: !loop && time >= duration, duration }
}
