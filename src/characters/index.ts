import { loadCharacter } from '../character.js'

/** Catalog only. Install and host only the character packs your application uses. */
export const characterNames = ['boniu', 'bolo', 'mimo', 'dogegg'] as const
export type BuiltInCharacter = typeof characterNames[number]
export function loadBuiltInCharacter(name: BuiltInCharacter, options: { signal?: AbortSignal; assetBaseUrl: string | URL }) {
  return loadCharacter(new URL(`${name}/character.json`, options.assetBaseUrl), { signal: options.signal })
}
