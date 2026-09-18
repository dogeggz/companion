import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { defineCharacter, sampleReaction, createCompanion, connectAgent } from '../src/index.js'
import type { AgentAdapter, CharacterPack } from '../src/index.js'

function fixture(): CharacterPack {
  return defineCharacter({ schemaVersion: 1, id: 'test', name: 'Test', size: { width: 16, height: 16 },
    assets: { sheet: { src: './sheet.png', width: 48, height: 16 } }, base: { asset: 'sheet', rect: [0, 0, 16, 16] }, defaultReaction: 'idle',
    reactions: {
      idle: { frames: [{ asset: 'sheet', rect: [0, 0, 16, 16], duration: 300 }], loop: true },
      thinking: { frames: [{ asset: 'sheet', rect: [16, 0, 16, 16], duration: 100 }], loop: true },
      success: { frames: [{ asset: 'sheet', rect: [16, 0, 16, 16], duration: 100 }, { asset: 'sheet', rect: [32, 0, 16, 16], duration: 250 }] },
      sad: { frames: [{ asset: 'sheet', duration: 200 }], returnTo: null },
    },
  }, 'https://example.test/subpath/characters/test/character.json')
}
const flush = () => new Promise<void>(resolve => setImmediate(resolve))

test('variable frame durations, boundaries, looping and one-shot completion', () => {
  const clip = fixture().reactions.success
  assert.equal(sampleReaction(clip, 99).index, 0)
  assert.equal(sampleReaction(clip, 100).index, 1)
  assert.equal(sampleReaction(clip, 349).done, false)
  assert.deepEqual(sampleReaction(clip, 350), { index: 1, done: true, duration: 350 })
  assert.deepEqual(sampleReaction(clip, 350, true), { index: 0, done: false, duration: 350 })
  assert.equal(sampleReaction(clip, -1).index, 0)
})

test('reject invalid packs and resolve asset paths against the manifest', () => {
  const pack = fixture()
  assert.equal(pack.assets.sheet.src, 'https://example.test/subpath/characters/test/sheet.png')
  const invalid = (change: (p: CharacterPack) => void) => { const p = structuredClone(pack); change(p); assert.throws(() => defineCharacter(p)) }
  invalid(p => { p.reactions.idle.frames = [] })
  invalid(p => { p.reactions.idle.frames[0].duration = 0 })
  invalid(p => { p.reactions.idle.frames[0].duration = NaN })
  invalid(p => { p.reactions.idle.frames[0].rect = [40, 0, 16, 16] })
  invalid(p => { p.defaultReaction = 'missing' })
  invalid(p => { p.reactions.success.returnTo = 'missing' })
  invalid(p => { p.reactions.success.poster = 99 })
  invalid(p => { p.base.asset = 'toString' })
  assert.throws(() => { pack.name = 'mutated' })
})

test('all built-in packs validate, including differing sizes and extra reactions', async () => {
  for (const name of ['boniu', 'bolo', 'mimo']) {
    const url = new URL(`../characters/${name}/character.json`, import.meta.url)
    const pack = defineCharacter(JSON.parse(await readFile(url, 'utf8')), url)
    for (const reaction of ['idle', 'thinking', 'notification', 'success', 'warning', 'sad']) assert.ok(pack.reactions[reaction])
    assert.ok(pack.reactions[name === 'mimo' ? 'dance' : 'sleepy'])
    assert.equal(pack.size.width, name === 'mimo' ? 240 : 256)
  }
})

test('custom reaction registration requires no core change; unknown name preserves state', () => {
  const pack = structuredClone(fixture()); pack.reactions['my-high-five'] = pack.reactions.success
  const c = createCompanion(pack)
  assert.equal(c.react('my-high-five'), true)
  let errors = 0; c.on('error', () => errors++)
  assert.equal(c.react('missing'), false)
  assert.equal(c.react('toString'), false)
  assert.equal(c.getSnapshot().reaction, 'my-high-five'); assert.equal(errors, 2)
})

test('single completion, return to idle, stale completion fencing and event-handler reentrancy', () => {
  const c = createCompanion(fixture()); let completes = 0
  c.on('complete', () => completes++)
  c.react('success'); const play = c.getSnapshot().playId
  c.finish(play); c.finish(play)
  assert.equal(completes, 1); assert.equal(c.getSnapshot().reaction, 'idle')
  c.react('success'); const stale = c.getSnapshot().playId; c.react('sad'); c.finish(stale)
  assert.equal(c.getSnapshot().reaction, 'sad'); assert.equal(completes, 1)
  c.finish(c.getSnapshot().playId, true); assert.equal(c.getSnapshot().reaction, 'sad')
  c.on('complete', () => c.react('thinking'))
  c.react('success'); c.finish(c.getSnapshot().playId)
  assert.equal(c.getSnapshot().reaction, 'thinking')
})

test('transport streams, cancels previous requests and ignores late results', async () => {
  const c = createCompanion(fixture())
  let release!: () => void
  const delayed = new Promise<void>(resolve => { release = resolve })
  let firstSignal!: AbortSignal
  const adapter: AgentAdapter = async function* ({ text, signal }) {
    if (text === 'first') { firstSignal = signal; await delayed; yield { type: 'text', text: 'stale' }; return }
    yield { type: 'text', text: 'hello' }; yield { type: 'delta', text: ' world' }
  }
  const binding = connectAgent(c, adapter)
  c.ask('first'); c.ask('second'); await flush()
  assert.equal(firstSignal.aborted, true)
  assert.equal(c.getSnapshot().text, 'hello world'); assert.equal(c.getSnapshot().reaction, 'success')
  release(); await flush(); assert.equal(c.getSnapshot().text, 'hello world')
  binding.disconnect(); c.ask('third'); await flush(); assert.equal(c.getSnapshot().text, 'hello world')
})

test('transport error, teardown, and character switch do not leave live streams', async () => {
  const c = createCompanion(fixture()); let errors = 0
  c.on('error', () => errors++)
  const binding = connectAgent(c, async function* () { yield { type: 'reaction', name: 'thinking' }; throw new Error('offline') })
  c.ask('fail'); await flush(); assert.equal(c.getSnapshot().reaction, 'sad'); assert.equal(errors, 1)
  binding.disconnect()
  let signal!: AbortSignal
  const next = connectAgent(c, async function* (req) { signal = req.signal; yield { type: 'text', text: 'ready' }; await new Promise(resolve => req.signal.addEventListener('abort', resolve, { once: true })) })
  c.ask('pending'); await flush(); c.setCharacter(fixture())
  assert.equal(signal.aborted, true); next.disconnect()
})
