import { createCompanion, connectAgent, type CharacterPack, type CompanionCommand } from '@companion-kit/core'
import { defineCompanion, type CompanionElement } from '@companion-kit/core/element'
import { loadBuiltInCharacter, type BuiltInCharacter } from '@companion-kit/core/characters'
import { mountReact } from './react.js'
import { mountVue } from './vue.js'

defineCompanion()
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const controller = createCompanion()
const avatar = $<CompanionElement>('#hero-companion'); avatar.controller = controller
const packs = new Map<BuiltInCharacter, CharacterPack>()
const assetBaseUrl = new URL('./assets/', location.href)
const titles: Record<string, [string, string, string]> = {
  boniu: ['波妞', 'Boniu', '粉色蝴蝶结，柔软的好奇心。'],
  bolo: ['波洛', 'Bolo', '短翘鬃毛，装着一点小勇气。'],
  mimo: ['米莫', 'Mimo', '小小机器人，也可以有大大的表情。'],
  dogegg: ['狗蛋', 'Dogegg', '黑白小礼服，藏着一点小帅气。'],
}
const moodNames: Record<string, [string, string, string]> = {
  idle: ['陪伴', 'Just here', '◌'], thinking: ['思考', 'Thinking', '···'],
  notification: ['通知', 'A little nudge', '↗'], success: ['好消息', 'We did it!', '✧'],
  warning: ['告警', 'Heads up', '!'], sad: ['小委屈', 'Oh, crumbs', '⌁'],
  sleepy: ['困困', 'Getting sleepy', 'z'], dance: ['跳个舞', 'Little dance', '♫'],
  'my-high-five': ['击掌', 'Custom reaction', '✋'],
}
const lines: Record<string, string> = { idle: '我在呢，你慢慢来。', thinking: '唔，让我再想一下。', notification: '叩叩，有一条新消息。', success: '耶！这次顺利完成啦。', warning: '有一点情况，我们一起看看？', sad: '有点不顺利……我们再试一次。', sleepy: '再陪你一小会儿……', dance: '嘀！今天的快乐充电完成。', 'my-high-five': '击个掌！新反应，不用改播放器。' }
function log(text: string) {
  const node = document.createElement('div'); node.textContent = text
  $('#event-log').prepend(node)
  while ($('#event-log').childElementCount > 8) $('#event-log').lastElementChild?.remove()
}
let demos: ReturnType<typeof mountReact>[] = []
let selected: BuiltInCharacter = 'dogegg'
let ticket = 0
async function select(name: BuiltInCharacter) {
  const id = ++ticket
  try {
    let pack = packs.get(name)
    if (!pack) { pack = await loadBuiltInCharacter(name, { assetBaseUrl }); packs.set(name, pack) }
    if (id !== ticket) return
    selected = name; controller.setCharacter(pack)
    document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.character === name)))
    const [zh, en, description] = titles[name]
    $('#character-name').textContent = zh; $('#character-en').textContent = en; $('#character-description').textContent = description
    $<HTMLAnchorElement>('#manifest-link').href = new URL(`${name}/character.json`, assetBaseUrl).href
    $('#pack-info').textContent = `${pack.size.width} × ${pack.size.height} · ${Object.keys(pack.reactions).length} 种反应 · ${name === 'mimo' ? '独立 SVG 帧' : '透明 PNG 图集'}`
    renderMoods(); controller.say(lines.idle)
    demos.forEach(demo => demo.controller.setCharacter(pack!))
    vanilla.controller.setCharacter(pack)
  } catch (error) { log(`error: ${String(error)}`); $('#character-description').textContent = '角色资源加载失败，请刷新重试。' }
}
function renderMoods() {
  $('#moods').replaceChildren()
  for (const name of controller.reactions) {
    const [zh, en, icon] = moodNames[name] ?? [name, 'Custom reaction', '✧']
    const button = document.createElement('button'); button.dataset.reaction = name
    const symbol = document.createElement('i'); symbol.textContent = icon
    const title = document.createElement('strong'); title.textContent = zh
    const caption = document.createElement('small'); caption.textContent = en
    button.append(symbol, title, caption)
    button.addEventListener('click', () => {
      controller.resume(); controller.react(name); controller.say(lines[name] ?? name)
      $('#command-code').textContent = `companion.react('${name}')`
      $<HTMLTextAreaElement>('#command').value = JSON.stringify({ type: 'react', reaction: name })
    })
    $('#moods').append(button)
  }
}
controller.subscribe(snapshot => {
  $('#current-state').textContent = snapshot.reaction ?? '…'
  $('#pause').textContent = snapshot.paused ? '▶ 继续' : 'Ⅱ 暂停'
  document.querySelectorAll<HTMLButtonElement>('#moods button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.reaction === snapshot.reaction)))
})
for (const event of ['statechange', 'request', 'action', 'complete', 'error'] as const) controller.on(event, detail => log(`${event}  ${JSON.stringify(detail)}`))
document.querySelectorAll<HTMLButtonElement>('[data-character]').forEach(button => button.addEventListener('click', () => void select(button.dataset.character as BuiltInCharacter)))
$('#theme').addEventListener('click', () => {
  const dark = document.body.classList.toggle('evening'); $('#theme').setAttribute('aria-pressed', String(dark)); $('#theme').textContent = dark ? '☀ 日光' : '☾ 晚风'
})
$('#pause').addEventListener('click', () => controller.getSnapshot().paused ? controller.resume() : controller.pause())
$('#replay').addEventListener('click', () => { controller.resume(); controller.react(controller.getSnapshot().reaction ?? 'idle') })
$('#add-reaction').addEventListener('click', () => {
  const pack = structuredClone(controller.getSnapshot().character!)
  const celebration = pack.reactions.success
  pack.reactions['my-high-five'] = { frames: [...celebration.frames, ...celebration.frames.slice().reverse()], poster: celebration.poster, returnTo: 'idle' }
  controller.setCharacter(pack); renderMoods(); controller.react('my-high-five'); controller.say(lines['my-high-five'])
  $('#pack-info').textContent = `${pack.size.width} × ${pack.size.height} · ${controller.reactions.length} 种反应 · 已添加 my-high-five`
  log('character extended: my-high-five (组合现有帧的演示)')
})
$('#send-command').addEventListener('click', () => {
  try {
    const value = JSON.parse($<HTMLTextAreaElement>('#command').value)
    if (!value || typeof value !== 'object') throw new Error('请提供一个命令对象')
    if (value.type === 'react' && typeof value.reaction === 'string') controller.react(value.reaction)
    else if ((value.type === 'say' || value.type === 'ask') && typeof value.text === 'string') controller.send(value as CompanionCommand)
    else if (['pause', 'resume', 'clear'].includes(value.type)) controller.send(value as CompanionCommand)
    else throw new Error('支持 react、say、ask、pause、resume、clear')
    $('#command-error').textContent = ''
  } catch (error) { $('#command-error').textContent = String(error) }
})

// Local deterministic demo; replace this adapter with your backend's stream.
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) { reject(signal.reason); return }
  const stop = () => { clearTimeout(timer); reject(signal.reason) }
  const timer = setTimeout(() => { signal.removeEventListener('abort', stop); resolve() }, ms)
  signal.addEventListener('abort', stop, { once: true })
})
const binding = connectAgent(controller, async function* ({ text, signal }) {
  await wait(650, signal)
  if (/失败|fail|error/.test(text)) throw new Error('这是一条模拟失败消息；可以再试一次。')
  yield { type: 'text', text: '' }
  for (const text of ['收到啦。', '我会先整理线索，', '再把下一步告诉你。']) {
    await wait(300, signal); yield { type: 'delta', text }
  }
})
controller.on('error', error => { if (error.code === 'agent') controller.say(error.message) })
$('#agent-form').addEventListener('submit', event => {
  event.preventDefault(); controller.resume(); controller.ask($<HTMLInputElement>('#prompt').value)
})
$('#cancel-agent').addEventListener('click', () => { binding.cancel(); log('request cancelled'); controller.say('好，先停在这里。') })
$('#simulate-error').addEventListener('click', () => { controller.resume(); controller.ask('模拟失败') })

const vanilla = $<CompanionElement>('#vanilla-demo')
$('#vanilla-button').addEventListener('click', () => { vanilla.react('thinking'); vanilla.say('Hello from plain HTML.'); $('#vanilla-state').textContent = 'thinking' })
vanilla.addEventListener('companion-statechange', event => { $('#vanilla-state').textContent = (event as CustomEvent).detail.reaction })
await select('dogegg')
const pack = packs.get(selected)!
demos = [mountReact($('#react-demo'), pack), mountVue($('#vue-demo'), pack)]
window.addEventListener('pagehide', () => binding.cancel())

// Test and integration inspection surface, containing no external services or credentials.
Object.assign(window, { companionDemo: { controller, binding, select, demos } })
