# Integration examples

Install core and your selected character packages using the [README](../README.md).
The same controller works with React, Vue and plain HTML.

## Plain HTML / controller

Copy `dist/` and your selected `characters/<id>/` folders to the static files your server embeds or serves. In the example below, Boniu lives under `assets/boniu/`.
Keep the relative paths inside it intact. Go controllers can embed these files
without running a JavaScript framework. No runtime package installation is needed.

```html
<script src="/static/companion/companion.global.js"></script>
<agent-companion
  id="friend"
  character-src="/static/companion/assets/boniu/character.json"
  size="160"
></agent-companion>
<script>
  const friend = document.querySelector('#friend')
  friend.say('Hello!')
  // Call reactions after the character is ready:
  friend.addEventListener('companion-characterchange', () => friend.react('thinking'))
  friend.addEventListener('companion-action', event => console.log(event.detail))
</script>
```

For ESM, import `defineCompanion` from `@companion-kit/core/element` and call it
once. Or import `@companion-kit/core/register` for automatic registration.
Importing the core or element module in Node/SSR does not access browser globals.
`defineCompanion()` is a no-op on the server.

## Vue 3

```vue
<script setup lang="ts">
import { createCompanion, type CharacterPack } from '@companion-kit/core'
import { Companion } from '@companion-kit/core/vue'

const props = defineProps<{ pack: CharacterPack }>()
const companion = createCompanion(props.pack)
// Use shallowRef/markRaw if you put this controller into reactive state.
</script>

<template>
  <Companion :controller="companion" :size="144" label="我的小助手" />
  <button @click="companion.react('notification')">新消息</button>
</template>
```

The Vue wrapper renders the custom element itself, so callers do not need
`compilerOptions.isCustomElement`. That setting is needed if a Vue template uses
`<agent-companion>` directly instead of the wrapper.

## Where artwork is served

With Vite, import an installed character directly. Its literal asset URLs are emitted and hashed by the bundler, including deployments below a URL prefix:

```ts
import dogegg from '@companion-kit/character-dogegg'
import { createCompanion, defineCharacter } from '@companion-kit/core'
const companion = createCompanion(defineCharacter(dogegg))
```

For other bundlers or plain HTML, copy only your installed character package to e.g. `public/companion-assets/dogegg/` and load its manifest explicitly:

```ts
import { loadCharacter, createCompanion } from '@companion-kit/core'

const pack = await loadCharacter('/companion-assets/dogegg/character.json')
const companion = createCompanion(pack)
```

Frame URLs are resolved **relative to the manifest URL**, including when the app
is served below a URL prefix. The builtin helper is also available:

```ts
import { loadBuiltInCharacter } from '@companion-kit/core/characters'

const pack = await loadBuiltInCharacter('bolo', {
  assetBaseUrl: new URL('./companion-assets/', document.baseURI),
})
```

`assetBaseUrl` (with a trailing slash) is required. Core includes only the catalog, never artwork; the host decides which packages to install and where to serve them. No production asset URL references this
development machine. Cross-origin manifests need the serving host to allow CORS.

## Styling and playback

The view uses Shadow DOM, a transparent canvas and a text bubble. Host CSS does
not restyle the internal canvas or message accidentally. Set CSS custom
properties or `::part(message)`, `::part(avatar)`, `::part(canvas)`:

```css
agent-companion {
  --companion-size: 144px;
  --companion-color: #405648;
  --companion-bubble: #fffdf7;
  --companion-border: #dce3d8;
  --companion-message-width: 280px;
  --companion-font-size: 12px;
}
```

Characters define loops and per-frame durations. One-shot reactions return to
the default reaction unless `returnTo: null` holds the last frame. Pausing
freezes the timeline; hidden tabs and disconnected elements do not animate.
Reduced motion displays a representative pose, while one-shot completion still
occurs after its logical duration. The avatar is keyboard accessible and emits
`action: { name: 'tap' }`. Bubble content is rendered as plain text.

## Moving and interacting with the host

The core's motion driver is DOM- and framework-independent. Coordinates and allowed
interaction targets are supplied by the host. Movement uses the pack's optional
`presentation.movement` map (eight directions); packs without it remain usable.
`presentation.peek` names the character's exposed paw/hoof reaction for a docked view.

```ts
import { createCompanionMotion } from '@companion-kit/core'
const motion = createCompanionMotion(controller, {
  position: { x: 40, y: 300 },
  onPosition: ({ x, y }) => { /* apply to your view */ },
  reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
})
const unregister = motion.registerTarget('notifications', {
  position: () => ({ x: 700, y: 60 }), // null if the target is unavailable
  activate: () => openNotificationPanel(),
})
await motion.visit('notifications', true)
// User drag, hidden state or navigation may cancel an in-flight visit.
motion.cancel()
unregister()
motion.dispose() // component unmount; cancels timers and stale activation
```

React and Vue hosts use the same driver with their position state. The SSE adapter
still accepts text/reaction events only: it never clicks arbitrary selectors or runs
model-generated JavaScript. A host chooses whether to register and invoke a target.


`createSSEAgent({ endpoint, body, headers, onSources })` also accepts an optional
`{type:"sources",items:[{title,url,revision}]}` SSE event. `onSources` receives bounded,
validated reference metadata for the host to render; it never executes actions or
navigates. The host owns session IDs, history persistence and internal routing.
The former locomotion cels were rejected for visual quality and withdrawn.
The eight `walk-*` reactions temporarily alias the original idle frames, preserving
character identity while the host moves the element. This is not a finished run
cycle. Automatic travel can now use teleport instead. Recall uses Dogegg’s paw and U-shaped pony horseshoes. See `locomotion.html`
and `docs/animation-production.md` for review status and replacement requirements.

## Teleport and appearance (core 0.6)

Dogegg, Boniu and Bolo packs 0.5.0 include two 12-frame portal clips, each 540ms.
The original character geometry is preserved while orbit rings and stars dissipate.
`presentation.appear` / `presentation.disappear` map these roles to arbitrary
reaction names; custom packs can provide their own PNG frames and timing.
Disappearance must end transparent; appearance must start transparent and end
with the normal pose. The generator is `artwork/teleport.py`.

```ts
const motion = createCompanionMotion(companion, {
  position: { x: 24, y: 300 },
  mode: 'teleport',
  onPosition: ({ x, y }) => setPosition({ x, y }),
  reducedMotion: () => matchMedia('(prefers-reduced-motion: reduce)').matches,
})
await motion.appear()                 // initial mount / recall, after assets are ready
await motion.moveTo({ x: 700, y: 80 }) // disappear → position jump → appear
await motion.disappear()              // hold transparent last cel, then hide/unmount
motion.dispose()                     // cancel on unmount
```

The existing registered-target `visit()` API uses the same mode and activates only
after arrival finishes. Methods resolve `false` on cancellation, superseding host
reactions or disposal. Dragging may call `cancel()` and retain control immediately.
Playback uses renderer `complete` events, so durations are not duplicated in host
code. Keep the renderer mounted through disappearance and call `dispose()` before
unmounting; paused/background playback waits until it resumes. Missing role clips
and reduced-motion hosts switch immediately. `mode: 'translate'` remains the
default for backwards compatibility. The framework has no built-in platform targets.

## Vite build watch

Some Vite/Rollup watch builds retain cached `new URL()` transforms while resetting
asset references between builds. Multiple character packs use filenames such as
`atlas.png` and `teleport.png`; a later incremental build can then point at another
pack's image. A clean production build does not exhibit this issue. If you serve
`vite build --watch` output, refresh pack transforms on each rebuild:

```ts
// vite.config.ts — add alongside your existing plugins
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [{
    name: 'companion-watch-assets',
    apply: 'build',
    shouldTransformCachedModule({ id }) {
      if (/\/@companion-kit\/character-[^/]+\/index\.js$/.test(id)) return true
    },
  }],
})
```

Restart the watcher after adding the plugin. This workaround belongs in the host's
build configuration and does not change the package's framework-neutral runtime.
