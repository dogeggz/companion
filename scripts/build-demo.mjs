import { build } from 'esbuild'
import { cp, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
process.chdir(fileURLToPath(new URL('../', import.meta.url)))
await rm('site', { recursive: true, force: true }); await mkdir('site', { recursive: true })
await build({ entryPoints: ['examples/studio.ts'], bundle: true, format: 'esm', outfile: 'site/studio.js', target: 'es2022', minify: true, define: { 'process.env.NODE_ENV': '"production"', __VUE_OPTIONS_API__: 'true', __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' } })
await cp('examples/index.html', 'site/index.html')
await cp('examples/style.css', 'site/style.css')
await cp('dist/assets', 'site/assets', { recursive: true })
await cp('dist', 'site/package', { recursive: true })
await cp('examples/plain.html', 'site/plain.html')
await cp('docs', 'site/docs', { recursive: true })
console.log('Built standalone studio and no-build controller example in site/.')
