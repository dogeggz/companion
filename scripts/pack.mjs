import { mkdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
await mkdir('test-results', {recursive:true})
for (const [dir, name] of [['.', 'core'], ...['boniu','bolo','mimo','dogegg'].map(id=>[`characters/${id}`, `character-${id}`])]) {
  const metadata = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'))
  execFileSync('bun', ['pm','pack','--filename',path.resolve(`test-results/companion-kit-${name}-${metadata.version}.tgz`),'--ignore-scripts','--quiet'], {cwd:dir,stdio:'inherit'})
}
