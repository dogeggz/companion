# Companion

A small, independent project for portable animated companions. The same player
works in a plain controller page, React, or Vue. Character packs supply the
artwork and arbitrary reactions; your application supplies the intelligence.

Included characters: **波妞 Boniu**, the girl pony with the rose bow;
**波洛 Bolo**, the boy pony with the mint scarf; and **米莫 Mimo**, a small robot.
Both ponies have idle, thinking, notification, success, warning, sad, and sleepy
animations. Mimo uses separate SVG frames and adds a dance reaction. These are
v0.1 art concepts; the names are suggestions, not locked branding.

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
bun pm pack
# In another project, install the resulting file:
bun add /path/to/companion-kit-core-0.1.0.tgz
```

`@companion-kit/core` has no runtime dependencies. React and Vue are optional
peer dependencies used only by their respective entry points. ESM and
TypeScript declarations ship alongside an ordinary global browser bundle.

## Plain HTML / controller

Copy the `dist/` directory to the static files your server embeds or serves.
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

Copy the exported `dist/assets/` directory to your app's public static assets,
for example `public/companion-assets/`, and load a manifest explicitly:

```ts
import { loadCharacter, createCompanion } from '@companion-kit/core'

const pack = await loadCharacter('/companion-assets/boniu/character.json')
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

Provide `assetBaseUrl` (with a trailing slash) when bundling. The helper's default
module-relative URL is for serving the ESM distribution intact; bundlers differ
in handling copied JSON directories. No production asset URL references this
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

`bun run artwork` rebuilds the source SVG cels and pony PNG atlases. Python 3
uses only its standard library; rasterization uses Playwright Chromium. Checked
in assets mean consumers never need Python or Playwright. Original artwork and
provenance are recorded in [NOTICE.md](NOTICE.md).
