import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { defineCharacter, sampleReaction, createCompanion, connectAgent, createSSEAgent } from '../src/index.js'
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
  for (const name of ['boniu', 'bolo', 'mimo', 'dogegg']) {
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


test('SSE handles byte-split Unicode and CRLF, validates events, and requires completion', async () => {
  let cancelled = false
  const bytes = new TextEncoder().encode(': heartbeat\r\n\r\ndata: {"type":"delta","text":"狗蛋"}\r\n\r\ndata: {"type":"reaction","name":"sad"}\r\n\r\ndata: {"type":"done"}\r\n\r\n')
  let offset = 0
  const response = new Response(new ReadableStream({pull(c) { if (offset < bytes.length) c.enqueue(bytes.slice(offset, ++offset)) },cancel(){cancelled=true}}),{headers:{'Content-Type':'text/event-stream'}})
  const adapter = createSSEAgent({endpoint:'https://host.test/chat',fetch:async (_url,init) => {
    assert.equal(init?.method,'POST')
    assert.deepEqual(JSON.parse(String(init?.body)),{text:'hello'})
    return response
  }})
  const request = {text:'hello',signal:new AbortController().signal,requestId:1}
  const updates = []
  for await (const update of adapter(request)) updates.push(update)
  assert.deepEqual(updates,[{type:'delta',text:'狗蛋'},{type:'reaction',name:'sad'}])
  assert.equal(cancelled,true)
  for (const raw of ['', 'data: {"type":"action","name":"delete"}\n\n', 'data: {"type":"error","message":"unavailable"}\n\n']) {
    const invalid = createSSEAgent({endpoint:'/chat',fetch:async()=>new Response(raw,{headers:{'Content-Type':'text/event-stream'}})})
    await assert.rejects(async()=>{ for await(const _update of invalid(request)) { /* consume */ } })
  }
})

test('an explicit sad reaction survives successful transport completion', async () => {
  const companion = createCompanion(fixture())
  const binding = connectAgent(companion,async function* () {
    yield {type:'reaction',name:'sad'}
    yield {type:'delta',text:'Sorry to hear that'}
  })
  companion.ask('bad news'); await flush()
  assert.equal(companion.getSnapshot().reaction,'sad')
  binding.disconnect()
})

test('motion follows eight directions, cancels stale visits and activates only registered targets', async () => {
  const {createCompanionMotion, directionFromVector} = await import('../src/motion.js')
  expect([[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]].map(([x,y])=>directionFromVector(x,y))).toEqual(['e','se','s','sw','w','nw','n','ne'])
  const controller = createCompanion()
  let now = 0, activated = 0
  const callbacks = new Map<number,()=>void>(); let counter = 0
  const points: {x:number;y:number}[] = []
  const motion = createCompanionMotion(controller, {position:{x:0,y:0}, speed:100, onPosition:p=>points.push(p), clock:{now:()=>now,schedule:cb=>{callbacks.set(++counter,cb);return counter},cancel:id=>{callbacks.delete(id as number)}}})
  const tick = (time:number) => {now=time;const pending=[...callbacks.values()];callbacks.clear();pending.forEach(cb=>cb())}
  motion.registerTarget('bell',{position:()=>({x:100,y:100}),activate:()=>{activated++}})
  const stale=motion.visit('bell',true);tick(200);motion.cancel();tick(2000)
  expect(await stale).toBe(false);expect(activated).toBe(0)
  const current=motion.visit('bell',true);tick(5000)
  expect(await current).toBe(true);expect(activated).toBe(1);expect(points.at(-1)).toEqual({x:100,y:100})
  expect(await motion.visit('unregistered',true)).toBe(false)
  const cancelled=motion.moveTo({x:500,y:0});motion.dispose();tick(10000)
  expect(await cancelled).toBe(false);expect(callbacks.size).toBe(0)
  expect(()=>motion.moveTo({x:NaN,y:0})).toThrow()
})


test('SSE source metadata is bounded, inert and only exposes safe links', async () => {
  const source = {title:'Guide',url:'/guide/intro',revision:'v1'}
  const seen: unknown[] = []
  const req = {text:'question',signal:new AbortController().signal,requestId:1}
  const adapter = (items: unknown) => createSSEAgent({endpoint:'/chat',onSources:s=>seen.push(s),fetch:async()=>new Response(
    `data: ${JSON.stringify({type:'sources',items})}\n\ndata: {"type":"done"}\n\n`,{headers:{'Content-Type':'text/event-stream'}})})
  for await (const _ of adapter([source])(req)) { assert.fail('Sources must not execute a companion action') }
  assert.deepEqual(seen,[[source]])
  for(const url of ['javascript:alert(1)','//untrusted.test','/\\evil.test','/hello world']) {
    await assert.rejects(async()=>{for await(const _ of adapter([{...source,url}])(req)){} })
  }
  await assert.rejects(async()=>{for await(const _ of adapter(Array(13).fill(source))(req)){} })
})


test('SSE checkpoints commit only on done, never on failure or abort', async () => {
  const seen: string[] = []
  for (const end of ['data: {"type":"done"}\n\n', '', 'data: {"type":"error","message":"failed"}\n\n']) {
    const adapter = createSSEAgent({endpoint:'/chat', onCheckpoint:s=>seen.push(s),fetch:async()=>new Response(
      'data: {"type":"checkpoint","token":"opaque-state"}\n\n'+end, {headers:{'Content-Type':'text/event-stream'}})})
    const consume = async()=>{for await (const _ of adapter({text:'test',requestId:1,signal:new AbortController().signal})) {}}
    if (end.includes('done')) await consume(); else await assert.rejects(consume)
  }
  assert.deepEqual(seen,['opaque-state'])
  const controller = new AbortController(); controller.abort()
  const adapter = createSSEAgent({endpoint:'/chat',onCheckpoint:s=>seen.push(s),fetch:async()=>new Response(
    'data: {"type":"checkpoint","token":"cancelled"}\n\ndata: {"type":"done"}\n\n', {headers:{'Content-Type':'text/event-stream'}})})
  for await (const _ of adapter({text:'test',requestId:2,signal:controller.signal})) {}
  assert.deepEqual(seen,['opaque-state'])
})


test('host-defined harness states map to arbitrary character reactions', async () => {
  const companion = createCompanion(fixture())
  const reaction = companion.reactions[0]
  const binding = connectAgent(companion, async function* () {
    yield {type:'state', name:'inventory_lookup'}
  }, {states:{inventory_lookup:reaction}})
  companion.ask('stock'); await flush()
  assert.equal(companion.getSnapshot().reaction,reaction)
  binding.disconnect()
})
