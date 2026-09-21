import manifest from './character.json' with {type:'json'};
export default {...manifest, assets: {"atlas": {...manifest.assets["atlas"], src: new URL("./atlas.png", import.meta.url).href},
"portrait": {...manifest.assets["portrait"], src: new URL("./base.png", import.meta.url).href},
"mobility": {...manifest.assets["mobility"], src: new URL("./mobility.png", import.meta.url).href},
"teleport": {...manifest.assets["teleport"], src: new URL("./teleport.png", import.meta.url).href}}};
