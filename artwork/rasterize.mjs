import { chromium } from 'playwright'
import { readFile, writeFile } from 'node:fs/promises'

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage()
  for (const character of ['boniu', 'bolo']) {
    for (const asset of ['base', 'atlas']) {
      const path = new URL(`../characters/${character}/${asset}`, import.meta.url)
      const svg = await readFile(`${path.pathname}.svg`, 'utf8')
      const png = await page.evaluate(async svg => {
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${btoa(svg)}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
        canvas.getContext('2d').drawImage(image, 0, 0)
        return canvas.toDataURL('image/png').split(',')[1]
      }, svg)
      await writeFile(`${path.pathname}.png`, Buffer.from(png, 'base64'))
    }
  }
} finally { await browser.close() }
