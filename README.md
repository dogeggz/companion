# Companion

A small, independent project for portable animated companions. The same player
works in a plain controller page, React, or Vue. Character packs supply the
artwork and arbitrary reactions; your application supplies the intelligence.

Included characters: **波妞 Boniu**, the girl pony with the rose bow;
**波洛 Bolo**, the boy pony with the mint scarf; **米莫 Mimo**, a small robot;
and **狗蛋 Dogegg**, a cheeky tuxedo boy cat with green eyes, a pink nose and
pink paw pads. The studio opens with Dogegg selected.
Both ponies have idle, thinking, notification, success, warning, sad, and sleepy
animations. Dogegg has the same seven reactions, drawn as flat vector cels and
exported to a transparent PNG atlas. Mimo uses separate SVG frames and adds a
dance reaction. These are
v0.2 art concepts; the names are suggestions, not locked branding.

## Package and development

```sh
bun install --frozen-lockfile
bun run check
bun run build
bun run demo:build
python3 -m http.server 8767 --bind 0.0.0.0 --directory site
```

Open `/` for the studio and `/plain.html` for the controller-style page with no
framework or bundler. The studio's agent is **a local simulation**, not an LLM.
The framework examples import the package's public exports. Nothing here
depends on the EvalHub checkout or backend.

This package is not published to a registry. To consume the actual artifact:

```sh
# In this project, after building:
bun run pack:all
# In another project, install core + only the desired characters:
bun add /path/to/test-results/companion-kit-core-0.3.0.tgz \
  /path/to/test-results/companion-kit-character-dogegg-0.3.0.tgz
```

`@companion-kit/core` has no runtime dependencies. React and Vue are optional
peer dependencies used only by their respective entry points. ESM and
TypeScript declarations ship alongside an ordinary global browser bundle.

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

## React

```tsx
import { useState } from 'react'
import { createCompanion, type CharacterPack } from '@companion-kit/core'
import { Companion } from '@companion-kit/core/react'

export function Assistant({ pack }: { pack: CharacterPack }) {
  const [companion] = useState(() => createCompanion(pack))
  return <>
    <Companion controller={companion} size={144} label="我的小助手" />
    <button onClick={() => companion.react('success')}>好消息</button>
  </>
}
```

The host owns the controller; do not create a new one on every render. For a
character change call `companion.setCharacter(nextPack)`. Unmounting the view
stops its animation, but does not dispose the controller or agent connection.

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

## Commands, events and agents

```ts
companion.react('thinking')
companion.say('Let me look into that.')
companion.ask('Help me understand this result')
companion.send({ type: 'react', reaction: 'my-custom-reaction' })
companion.on('action', ({ name, data }) => { /* host handles a tap or custom action */ })
```

See [the agent protocol](docs/agent-protocol.md) for streaming adapters,
cancellation, errors and event names. This project does not contain a model,
tool executor, auth system or application-specific event mapping. Those belong
to the host; messages and animation commands work without a model.

See [character packs](docs/character-packs.md) to create new characters or add a
reaction. `react(name)` accepts any configured name: no enum or new core API is
required. PNG/WebP atlas cells and independent PNG/WebP/SVG images use the same
schema. GIF/APNG can be used as a static image source only at the browser's own
timing; for controllable reactions export explicit frames.

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

## Verification and artwork

```sh
bun run check
bun run build
bun run demo:build
bun run test:package
# Install a Playwright Chromium once, or set PLAYWRIGHT_BROWSERS_PATH:
bunx playwright install chromium
bun run test:browser
```

`test:package` packs and installs the actual tarball into a clean consumer and
checks imports without React/Vue or a DOM. Framework fixtures then reuse the
installed dev peers through local links; the companion package is never linked
to source. The browser suite exercises the three
consumers, all character packs, command/event flow, reduced motion, disconnects,
and asset loading under a nested URL prefix. Build tools are development-only.

`bun run artwork` rebuilds the source SVG cels and pony/cat PNG atlases. Python 3
uses only its standard library; rasterization uses Playwright Chromium. Checked
in assets mean consumers never need Python or Playwright. Original artwork and
provenance are recorded in [NOTICE.md](NOTICE.md).

Dogegg's editable rig is `artwork/cat.py`. Its design reference and review sheet
live in `artwork/dogegg/`, outside the runtime assets. Load it using
`loadBuiltInCharacter('dogegg', { assetBaseUrl })` or serve
`assets/dogegg/character.json` with its neighboring PNG files.

## Selective installation (0.2 migration)

The core tarball contains **no default artwork**. Independently installable packages:

- `@companion-kit/character-dogegg` — 狗蛋 Dogegg (renamed from `goudan`)
- `@companion-kit/character-boniu` — 波妞 Boniu
- `@companion-kit/character-bolo` — 波洛 Bolo
- `@companion-kit/character-mimo` — Mimo

`bun run build && bun run pack:all` produces five ordinary npm-compatible tarballs
in `test-results/`. They are not published to a registry. Add any selection with
`bun add ./vendor/<filename>.tgz`. A project needing only the ponies installs core
plus the Boniu and Bolo tarballs. A project using its own art installs core alone.
There is no all-characters dependency and no postinstall download. Lazy-importing
a character also defers its network load until the user selects it.

0.1 consumers: replace `core/dist/assets` with individually installed packs;
`loadBuiltInCharacter` now requires `assetBaseUrl`; `characterUrls` is removed.
The runtime manifest schema and React/Vue/native component APIs are unchanged.

## POST SSE

```ts
import { connectAgent, createSSEAgent } from '@companion-kit/core'
const connection = connectAgent(companion, createSSEAgent({
  endpoint: '/api/companion/chat',
  credentials: 'include',
  body: text => ({ text, character: 'dogegg' }),
}))
companion.ask('Hello!')
// connection.cancel() or connection.disconnect()
```

The server sends JSON in SSE `data:` frames: `delta`, `text`, `reaction`,
`error`, then `done`. This is a host/backend protocol, not a direct model-provider
connection. Keys and provider configuration belong on the backend. See
[agent protocol](docs/agent-protocol.md).


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

## Generic agent framework

See [framework and host responsibilities](docs/framework.md) for character/state configuration, portable SSE, and the separately installable [Python harness](server/README.md). Hosts supply their own system prompt, knowledge, tools, authorization and storage. The framework has no EvalHub business dependency. Core 0.5.0 supports named state mapping and completed-stream checkpoints; server harness 0.1.0 supports configurable tool loops, JSON-schema validation and host-authorized writes. Public registry publication has not been performed.


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
