import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('../', import.meta.url))
const site = path.join(root, 'site')
const results = path.join(root, 'test-results')
await mkdir(results, { recursive: true })
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' }
const prefix = '/nested/demo/'
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost')
    if (!url.pathname.startsWith(prefix)) { response.writeHead(404).end(); return }
    let file = path.resolve(site, decodeURIComponent(url.pathname.slice(prefix.length)) || 'index.html')
    if (!file.startsWith(site + path.sep)) { response.writeHead(403).end(); return }
    if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html')
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] ?? 'application/octet-stream' })
    response.end(await readFile(file))
  } catch { response.writeHead(404).end() }
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const address = server.address()
const base = `http://127.0.0.1:${address.port}${prefix}`
const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`) })
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.companionDemo?.demos.length === 2)
  const hero = page.locator('#hero-companion')
  const waitArt = () => page.waitForFunction(() => {
    const canvas = document.querySelector('#hero-companion').shadowRoot.querySelector('canvas')
    return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.some((n, i) => i % 4 === 3 && n > 0)
  })
  await waitArt()
  await page.screenshot({ path: path.join(results, 'studio-desktop.png'), fullPage: true })

  const portraits = []
  for (const character of ['boniu', 'bolo', 'mimo']) {
    await page.locator(`[data-character="${character}"]`).click()
    await page.waitForFunction(id => document.querySelector('#hero-companion').character?.id === id, character)
    await waitArt()
    portraits.push(await hero.locator('canvas').evaluate(canvas => canvas.toDataURL()))
    const names = await page.evaluate(() => window.companionDemo.controller.reactions)
    assert.ok(names.includes(character === 'mimo' ? 'dance' : 'sleepy'))
    for (const reaction of ['thinking', 'notification', 'success', 'warning', 'sad', character === 'mimo' ? 'dance' : 'sleepy']) {
      await page.evaluate(reaction => window.companionDemo.controller.react(reaction, { loop: true }), reaction)
      await page.waitForTimeout(360)
      assert.equal(await hero.getAttribute('data-reaction'), reaction)
      assert.ok(Number(await hero.getAttribute('data-frame')) > 0, `${character}/${reaction} advances`)
    }
  }
  assert.equal(new Set(portraits).size, 3, 'three distinct characters rendered')
  await page.locator('[data-character="boniu"]').click(); await waitArt()
  await page.locator('#add-reaction').click()
  assert.ok(await page.locator('[data-reaction="my-high-five"]').count())
  await page.waitForFunction(() => document.querySelector('#hero-companion').dataset.reaction === 'my-high-five')
  await page.evaluate(() => window.companionDemo.controller.react('thinking'))
  await page.waitForTimeout(330); await page.locator('#pause').click()
  const frozen = await hero.getAttribute('data-frame')
  await page.waitForTimeout(180); assert.equal(await hero.getAttribute('data-frame'), frozen)
  await page.locator('#pause').click(); await page.waitForTimeout(220)
  assert.notEqual(await hero.getAttribute('data-frame'), frozen)

  await page.evaluate(() => {
    window.companionDemo.controller.say('<img src=x onerror=alert(1)>')
    window.tapCount = 0
    document.querySelector('#hero-companion').addEventListener('companion-action', event => { if (event.detail.name === 'tap') window.tapCount++ })
  })
  assert.equal(await hero.locator('.message img').count(), 0)
  assert.equal(await hero.locator('.message').textContent(), '<img src=x onerror=alert(1)>')
  await hero.getByRole('button').focus(); await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => window.tapCount), 1)

  await page.locator('#prompt').fill('hello')
  await page.locator('#agent-form button').click()
  await page.waitForFunction(() => window.companionDemo.controller.getSnapshot().text.endsWith('下一步告诉你。'))
  await page.locator('#simulate-error').click()
  await page.waitForFunction(() => window.companionDemo.controller.getSnapshot().reaction === 'sad')
  assert.match(await hero.locator('.message').textContent(), /模拟失败/)
  await page.locator('#agent-form button').click(); await page.locator('#cancel-agent').click()
  await page.waitForTimeout(800)
  assert.equal(await hero.locator('.message').textContent(), '好，先停在这里。')

  for (const [adapter, button, reaction] of [['vanilla', '#vanilla-button', 'thinking'], ['react', '#react-demo .framework-demo > button', 'success'], ['vue', '#vue-demo .framework-demo > button', 'notification']]) {
    await page.locator(button).click()
    await page.waitForFunction(({adapter, reaction}) => document.querySelector(`[data-adapter="${adapter}"] agent-companion`).controller.getSnapshot().reaction === reaction, { adapter, reaction })
  }
  // Updating bubble text frequently must not restart the animation clock.
  await page.evaluate(() => {
    const c = window.companionDemo.controller; c.react('thinking')
    window.spam = setInterval(() => c.say(String(Date.now())), 20)
  })
  await page.waitForTimeout(500)
  assert.ok(Number(await hero.getAttribute('data-frame')) > 0)
  await page.evaluate(() => clearInterval(window.spam))

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    const c = window.companionDemo.controller
    window.reducedCompletion = false
    c.on('complete', event => { if (event.reducedMotion) window.reducedCompletion = true })
    c.react('thinking')
  })
  assert.equal(await hero.getAttribute('data-frame'), '5')
  await page.waitForTimeout(200); assert.equal(await hero.getAttribute('data-frame'), '5')
  await page.evaluate(() => window.companionDemo.controller.react('success'))
  await page.waitForFunction(() => window.reducedCompletion && window.companionDemo.controller.getSnapshot().reaction === 'idle')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    const element = document.querySelector('#hero-companion'); window.detachedHero = element; element.remove()
    window.companionDemo.controller.react('thinking')
  })
  const detached = await page.evaluate(() => window.detachedHero.dataset.frame)
  await page.waitForTimeout(250)
  assert.equal(await page.evaluate(() => window.detachedHero.dataset.frame), detached)
  await page.evaluate(() => document.querySelector('.portrait-stage').append(window.detachedHero))
  await waitArt(); await page.waitForTimeout(350)
  assert.equal(await hero.getAttribute('data-reaction'), 'thinking')
  await page.evaluate(() => window.companionDemo.controller.say('今天，也在认真陪你。'))
  await page.locator('#theme').click()
  await page.screenshot({ path: path.join(results, 'studio-evening.png'), fullPage: true })
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `no overflow at ${width}px`)
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: path.join(results, 'studio-mobile.png'), fullPage: true })

  await page.goto(`${base}plain.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => document.querySelector('#friend').dataset.frame !== undefined)
  assert.equal(await page.evaluate(() => document.querySelector('#friend').character.id), 'bolo')
  await page.locator('#switch').click()
  await page.waitForFunction(() => document.querySelector('#friend').character.id === 'boniu')
  await page.locator('#think').click()
  await page.waitForFunction(() => document.querySelector('#friend').dataset.reaction === 'thinking')
  assert.equal(await page.evaluate(() => typeof window.React), 'undefined')

  // This page is built by test:package from a tarball installed in a different directory.
  await page.goto(`${base}consumer.html`, { waitUntil: 'networkidle' })
  await page.waitForFunction(() => window.packedConsumers?.length === 3 && document.querySelectorAll('agent-companion').length === 3)
  await page.evaluate(() => window.packedConsumers.forEach(c => { c.react('thinking'); c.say('Packed package works'); }))
  await page.waitForTimeout(450)
  assert.equal(await page.locator('agent-companion[data-reaction="thinking"]').count(), 3)
  for (const canvas of await page.locator('agent-companion canvas').all()) {
    assert.ok(await canvas.evaluate(c => c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i) => i%4===3 && v > 0)))
  }
  await page.evaluate(() => window.unmountConsumers())
  assert.equal(await page.locator('agent-companion').count(), 0)
  assert.deepEqual(errors, [])
  const summary = 'PASS: three characters, all reactions, custom reaction, text safety, keyboard actions, pause/resume, agent success/error/cancel, React/Vue/native consumers, streaming animation, reduced motion, reconnect, 320/390px, nested paths and real tarball installation.'
  await writeFile(path.join(results, 'browser-summary.txt'), summary + '\n')
  console.log(summary)
} finally {
  await browser.close()
  await new Promise(resolve => server.close(resolve))
}
