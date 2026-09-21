import { readFile, writeFile } from 'node:fs/promises'
for (const id of ['boniu', 'bolo', 'mimo', 'dogegg']) {
  const dir = `characters/${id}`
  const pack = JSON.parse(await readFile(`${dir}/character.json`, 'utf8'))
  await writeFile(`${dir}/package.json`, JSON.stringify({
    name: `@companion-kit/character-${id}`, version: ['boniu', 'bolo'].includes(id) ? '0.4.2' : '0.4.1', type: 'module',
    description: `${pack.name} sprite pack for Companion`,
    exports: { '.': { types: './index.d.ts', import: './index.js' }, './character.json': './character.json', './assets/*': './*' },
    files: ['index.js', 'index.d.ts', 'character.json', ...new Set(Object.values(pack.assets).map(asset => asset.src.replace(/^\.\//, '').split('/')[0]))], sideEffects: false,
  }, null, 2) + '\n')
  // Literal URLs let Vite/Rollup emit and hash each installed asset under any base path.
  const assets = Object.entries(pack.assets).map(([key, value]) => `${JSON.stringify(key)}: {...manifest.assets[${JSON.stringify(key)}], src: new URL(${JSON.stringify(value.src)}, import.meta.url).href}`).join(',\n')
  await writeFile(`${dir}/index.js`, `import manifest from './character.json' with {type:'json'};\nexport default {...manifest, assets: {${assets}}};\n`)
  await writeFile(`${dir}/index.d.ts`, "declare const character: import('@companion-kit/core').CharacterPack;\nexport default character;\n")
}
