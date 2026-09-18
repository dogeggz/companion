import { loadCharacter } from '../character.js'

/** URLs are relative to the distributed module, never to a consumer's origin root. */
export const characterUrls = {
  boniu: new URL('./assets/boniu/character.json', import.meta.url).href,
  bolo: new URL('./assets/bolo/character.json', import.meta.url).href,
  mimo: new URL('./assets/mimo/character.json', import.meta.url).href,
}
export type BuiltInCharacter = keyof typeof characterUrls
export function loadBuiltInCharacter(name: BuiltInCharacter, options: { signal?: AbortSignal; assetBaseUrl?: string | URL } = {}) {
  const url = options.assetBaseUrl ? new URL(`${name}/character.json`, options.assetBaseUrl) : characterUrls[name]
  return loadCharacter(url, { signal: options.signal })
}
