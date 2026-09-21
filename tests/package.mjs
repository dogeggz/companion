import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cp, mkdtemp, mkdir, readFile, readdir, writeFile, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('../', import.meta.url))
const results = path.join(root, 'test-results')
await mkdir(results, { recursive: true })
const metadataSource = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const archive = { filename: `${metadataSource.name.replace(/^@/, '').replaceAll('/', '-')}-${metadataSource.version}.tgz` }
execFileSync('bun', ['pm', 'pack', '--filename', path.join(results, archive.filename), '--ignore-scripts', '--quiet'], { cwd: root, stdio: 'pipe' })
const consumer = await mkdtemp(path.join(tmpdir(), 'companion-consumer-'))
await writeFile(path.join(consumer, 'package.json'), JSON.stringify({ name: 'independent-consumer', private: true, type: 'module' }))
const install = (...args) => execFileSync('bun', ['add', '--ignore-scripts', ...args], { cwd: consumer, stdio: 'pipe' })
execFileSync('bun', ['run', 'pack:all'], {cwd:root,stdio:'pipe'})
await mkdir(path.join(consumer, 'vendor'))
for (const file of [archive.filename, 'companion-kit-character-dogegg-0.2.0.tgz']) await cp(path.join(results, file), path.join(consumer, 'vendor', file))
install(path.join(consumer, 'vendor', archive.filename), path.join(consumer, 'vendor', 'companion-kit-character-dogegg-0.2.0.tgz'))
const installed = path.join(consumer, 'node_modules/@companion-kit/core')
const metadata = JSON.parse(await readFile(path.join(installed, 'package.json'), 'utf8'))
assert.equal(metadata.name, '@companion-kit/core')
assert.equal(metadata.dependencies, undefined)
assert.ok(!(await readdir(path.join(installed, 'dist'))).includes('assets'))
const installedPack = path.join(consumer, 'node_modules/@companion-kit/character-dogegg')
assert.deepEqual((await readdir(path.dirname(installedPack))).sort(), ['character-dogegg', 'core'])
const dogegg = JSON.parse(await readFile(path.join(installedPack, 'character.json'), 'utf8'))
assert.equal(dogegg.name, '狗蛋')
for (const asset of Object.values(dogegg.assets)) {
  const png = await readFile(path.join(installedPack, asset.src))
  assert.equal(png.readUInt32BE(16), asset.width)
  assert.equal(png.readUInt32BE(20), asset.height)
}
assert.ok(!(await readdir(path.join(installed, 'dist'), { recursive: true })).some(file => /design-reference|review\.(png|svg)|prompts\.md/.test(file)))
await writeFile(path.join(consumer, 'core.mjs'), `
import assert from 'node:assert/strict';
import { createCompanion, defineCharacter } from '@companion-kit/core';
import { defineCompanion } from '@companion-kit/core/element';
import '@companion-kit/core/register';
import { characterNames } from '@companion-kit/core/characters';
const c = createCompanion(); c.say('works without a DOM');
assert.equal(c.getSnapshot().text, 'works without a DOM');
assert.equal(defineCompanion(), undefined);
assert.ok(characterNames.includes('dogegg'));
for (const framework of ['react', 'vue']) {
  try { await import(framework); assert.fail('Unexpected runtime framework dependency'); }
  catch(error) { assert.equal(error.code, 'ERR_MODULE_NOT_FOUND'); }
}
console.log('Packed core imports without React, Vue or browser globals.');
`)
execFileSync(process.execPath, ['core.mjs'], { cwd: consumer, stdio: 'inherit' })
// Supply existing host peer dependencies without a second registry download.
// The companion library itself is still the independently installed tarball.
for (const peer of ['react', 'react-dom', 'vue']) await symlink(path.join(root, 'node_modules', peer), path.join(consumer, 'node_modules', peer), 'dir')
await writeFile(path.join(consumer, 'ssr.mjs'), `
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { createSSRApp, h } from 'vue';
import { renderToString as renderVue } from 'vue/server-renderer';
import { Companion as ReactCompanion } from '@companion-kit/core/react';
import { Companion as VueCompanion } from '@companion-kit/core/vue';
import { createCompanion } from '@companion-kit/core';
const controller = createCompanion();
assert.ok(renderToString(createElement(ReactCompanion, {controller})).includes('agent-companion'));
assert.ok((await renderVue(createSSRApp({render:()=>h(VueCompanion,{controller})}))).includes('agent-companion'));
console.log('Packed React and Vue adapters render in SSR.');
`)
execFileSync(process.execPath, ['ssr.mjs'], { cwd: consumer, stdio: 'inherit' })
// Build a completely separate consumer from the installed tarball, not project source.
await cp(installedPack, path.join(root, 'site/packed-assets/dogegg'), { recursive: true })
await writeFile(path.join(consumer, 'main.js'), `
import {createCompanion,loadCharacter} from '@companion-kit/core';
import {defineCompanion} from '@companion-kit/core/element';
import {Companion as ReactCompanion} from '@companion-kit/core/react';
import {Companion as VueCompanion} from '@companion-kit/core/vue';
import {createElement} from 'react'; import {createRoot} from 'react-dom/client';
import {createApp,h} from 'vue';
defineCompanion();
const pack=await loadCharacter(new URL('./packed-assets/dogegg/character.json',location.href));
const a=createCompanion(pack), b=createCompanion(pack), c=createCompanion(pack);
document.querySelector('#plain').controller=a;
const reactRoot=createRoot(document.querySelector('#react')); reactRoot.render(createElement(ReactCompanion,{controller:b,size:120}));
const vueApp=createApp({render:()=>h(VueCompanion,{controller:c,size:120})}); vueApp.mount('#vue');
Object.assign(window,{packedConsumers:[a,b,c],unmountConsumers:()=>{reactRoot.unmount();vueApp.unmount();document.querySelector('#plain').remove()}});
`)
await build({ absWorkingDir: consumer, entryPoints: ['main.js'], bundle: true, format: 'esm', target: 'es2022', outfile: path.join(root, 'site/consumer.js'), minify: true, define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
await writeFile(path.join(root, 'site/consumer.html'), '<!doctype html><html><meta charset="utf-8"><title>Installed package consumers</title><agent-companion id="plain" size="120"></agent-companion><div id="react"></div><div id="vue"></div><script type="module" src="./consumer.js"></script></html>')
console.log(`Package verified: ${archive.filename}; three-framework consumer built from an independent installation.`)
