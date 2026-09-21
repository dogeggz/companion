export interface SpriteAsset { src: string; width: number; height: number }
export interface SpritePose { asset: string; rect?: [number, number, number, number] }
export interface SpriteFrame extends SpritePose { duration: number }
export interface Reaction {
  frames: SpriteFrame[]
  loop?: boolean
  poster?: number
  /** Omit to return to defaultReaction; null holds the final frame. */
  returnTo?: string | null
}
export interface CharacterPack {
  schemaVersion: 1
  id: string
  name: string
  description?: string
  size: { width: number; height: number }
  assets: Record<string, SpriteAsset>
  base: SpritePose
  /** Optional host presentation roles; arbitrary reaction names stay supported. */
  presentation?: { movement?: Partial<Record<import('./motion.js').Direction, string>>; peek?: string }
  defaultReaction: string
  reactions: Record<string, Reaction>
}
export interface ReactOptions { loop?: boolean; returnTo?: string | null }
export interface CompanionSnapshot {
  character: CharacterPack | null
  reaction: string | null
  text: string
  paused: boolean
  playId: number
  loop: boolean
  returnTo: string | null
}
export interface CompanionEvents {
  statechange: { reaction: string; playId: number }
  characterchange: { character: CharacterPack }
  message: { text: string }
  request: { text: string; id: number }
  action: { name: string; data?: unknown }
  complete: { reaction: string; playId: number; reducedMotion: boolean }
  error: { code: string; message: string }
}
export type CompanionCommand =
  | ({ type: 'react'; reaction: string } & ReactOptions)
  | { type: 'say'; text: string }
  | { type: 'ask'; text: string }
  | { type: 'action'; name: string; data?: unknown }
  | { type: 'pause' | 'resume' | 'clear' }
export type AgentUpdate =
  | { type: 'state'; name: string }
  | { type: 'text'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'reaction'; name: string }
  | { type: 'action'; name: string; data?: unknown }
export interface AgentRequest { text: string; signal: AbortSignal; requestId: number }
export type AgentAdapter = (request: AgentRequest) => AsyncIterable<AgentUpdate>
