import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
process.chdir(root)
const run = (command, args) => execFileSync(command, args, { cwd: root, stdio: 'inherit' })
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
if (git('status', '--porcelain')) throw new Error('Commit source changes before preparing a release.')
const commit = git('rev-parse', 'HEAD')
const core = JSON.parse(await readFile('package.json', 'utf8'))
const tag = `v${core.version}`
const directory = path.join(root, 'release')
await rm(directory, { recursive: true, force: true })
await mkdir(directory, { recursive: true })
run('bun', ['run', 'build'])
run('bun', ['run', 'pack:all'])
const packages = []
for (const folder of ['.', ...['dogegg', 'boniu', 'bolo', 'mimo'].map(id => `characters/${id}`)]) {
  const meta = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'))
  const file = `${meta.name.replace(/^@/, '').replaceAll('/', '-')}-${meta.version}.tgz`
  await copyFile(path.join('test-results', file), path.join(directory, file))
  packages.push({ name: meta.name, version: meta.version, kind: 'npm', file })
}
run('uv', ['build', '--wheel', '--out-dir', directory, 'server'])
const python = await readFile('server/pyproject.toml', 'utf8')
const version = python.match(/^version\s*=\s*"([^"]+)"/m)?.[1]
if (!version) throw new Error('Cannot read harness version')
packages.push({ name: 'companion-harness', version, kind: 'python', file: `companion_harness-${version}-py3-none-any.whl` })
if (git('status', '--porcelain')) throw new Error('Build changed tracked sources; commit generated files before releasing.')
const base = `https://github.com/dogeggz/companion/releases/download/${tag}`
for (const pkg of packages) {
  const bytes = await readFile(path.join(directory, pkg.file))
  Object.assign(pkg, { sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, url: `${base}/${pkg.file}` })
}
await writeFile(path.join(directory, 'manifest.json'), JSON.stringify({ schemaVersion: 1, tag, commit, packages }, null, 2) + '\n')
const manifestHash = createHash('sha256').update(await readFile(path.join(directory, 'manifest.json'))).digest('hex')
await writeFile(path.join(directory, 'SHA256SUMS'), packages.map(pkg => `${pkg.sha256}  ${pkg.file}`).concat(`${manifestHash}  manifest.json`).join('\n') + '\n')
const notes = `Install Companion from the attached package URLs with Bun; no source checkout or npm registry account is required. Install core plus only the character packs you need. The optional Python harness is separate.\n\n| Package | Version | Artifact |\n| --- | --- | --- |\n${packages.map(pkg => `| ${pkg.name} | ${pkg.version} | [${pkg.file}](${pkg.url}) |`).join('\n')}\n\nExample (core + Bolo):\n\n\`\`\`sh\nbun add ${base}/companion-kit-core-${core.version}.tgz \\\n  ${base}/companion-kit-character-bolo-${packages.find(pkg => pkg.name.endsWith('/character-bolo')).version}.tgz\n\`\`\`\n\nSHA256SUMS verifies all package files and manifest.json. The manifest records package versions and source commit ${commit}. These are npm-compatible tarballs and a Python wheel, not npm/PyPI registry publications. See the README and NOTICE.md for integration and artwork provenance.\n`
await writeFile(path.join(directory, 'RELEASE_NOTES.md'), notes)
console.log(`Prepared ${tag} from ${commit}: ${packages.length} installable packages, manifest and checksums in release/. Nothing uploaded.`)
