import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })
await build({
  entryPoints: {
    index: 'src/index.ts', element: 'src/element.ts', register: 'src/register.ts',
    react: 'src/adapters/react.tsx', vue: 'src/adapters/vue.ts', characters: 'src/characters/index.ts',
  },
  bundle: true, splitting: true, format: 'esm', platform: 'browser', target: 'es2022',
  outdir: 'dist', external: ['react', 'vue'], minify: true, sourcemap: true,
})
await build({ entryPoints: ['src/browser.ts'], bundle: true, format: 'iife', globalName: 'CompanionKit', target: 'es2022', outfile: 'dist/companion.global.js', minify: true, sourcemap: true })
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '--emitDeclarationOnly', '-p', 'tsconfig.json'], { stdio: 'inherit' })
await cp('characters', 'dist/assets', { recursive: true })
console.log('Built ESM, global browser bundle, declarations and character packs.')
