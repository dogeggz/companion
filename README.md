# Companion

Portable animated assistants for React, Vue and plain HTML. Install the runtime
and the characters you want; connect your own backend for conversations and tools.

- **One runtime:** sprite playback, reactions, appearance/disappearance, teleport,
  commands and events. React and Vue are optional adapters.
- **Separate character packs:** 波洛 Bolo, 波妞 Boniu, 狗蛋 Dogegg and Mimo.
  Core includes no artwork and downloads no characters automatically.
- **Your application supplies the intelligence:** prompts, knowledge, model access,
  tools, permissions and session storage. An optional Python harness handles the
  model/tool loop.

## Install

Downloadable packages live in [GitHub Releases](https://github.com/dogeggz/companion/releases).
These are standard npm-compatible tarballs; **Bun installs them directly from their
URLs and records them in `package.json` and `bun.lock`**. No repository checkout,
local build or npm registry publication is required.

For example, install the runtime and Bolo:

```sh
bun add \
  https://github.com/dogeggz/companion/releases/download/v0.6.1/companion-kit-core-0.6.1.tgz \
  https://github.com/dogeggz/companion/releases/download/v0.6.1/companion-kit-character-bolo-0.5.1.tgz
```

Choose any combination of these packages from the same release:

| Package | Version | Purpose |
| --- | --- | --- |
| `@companion-kit/core` | 0.6.1 | Required browser runtime; React/Vue adapters included |
| `@companion-kit/character-bolo` | 0.5.1 | 波洛 · boy pony |
| `@companion-kit/character-boniu` | 0.5.1 | 波妞 · girl pony |
| `@companion-kit/character-dogegg` | 0.5.1 | 狗蛋 · tuxedo cat |
| `@companion-kit/character-mimo` | 0.4.2 | Mimo · robot |

Use the corresponding `companion-kit-character-<name>-<version>.tgz` URL to add
another character. Custom artwork needs only core. For offline installs, download
the selected archives into your project and run `bun add ./vendor/<file>.tgz`.
Use versioned URLs when upgrading; each release also includes `SHA256SUMS` and a
machine-readable `manifest.json`.

## React quick start

In a React project with Vite:

```tsx
import { useState } from 'react'
import { createCompanion } from '@companion-kit/core'
import { Companion } from '@companion-kit/core/react'
import bolo from '@companion-kit/character-bolo'

export function Assistant() {
  const [companion] = useState(() => createCompanion(bolo))

  return (
    <>
      <Companion controller={companion} size={144} label="Chat with Bolo" />
      <button onClick={() => companion.react('success')}>Celebrate</button>
    </>
  )
}
```

Vite emits the imported character's images as static assets. Your application
provides React; plain HTML users do not need React or Vue. For Vue, static asset
hosting, CSS customization and the `vite build --watch` asset-cache workaround,
see [integration examples](docs/integration.md).

## Connect a backend

```ts
import { connectAgent, createSSEAgent } from '@companion-kit/core'

const connection = connectAgent(companion, createSSEAgent({
  endpoint: '/api/assistant/chat',
  credentials: 'include',
  body: text => ({ text, character: 'bolo' }),
}))

companion.ask('Help me understand this result')
// On unmount: connection.disconnect()
```

Your backend sends SSE events such as `delta`, `reaction` and `done`. It owns
credentials, user identity and business actions. The browser does not contact a
model provider automatically. See the [stream protocol](docs/agent-protocol.md)
for state mapping, cancellation, sources and completed-session checkpoints.

Python hosts can install the optional harness independently:

```sh
uv add https://github.com/dogeggz/companion/releases/download/v0.6.1/companion_harness-0.1.0-py3-none-any.whl
```

See [harness setup](server/README.md) and [framework/host responsibilities](docs/framework.md).
Other backend languages can implement the same SSE protocol.

## Documentation

- [React, Vue, plain HTML, assets and styling](docs/integration.md)
- [Custom characters and reaction frames](docs/character-packs.md)
- [Agent streams and events](docs/agent-protocol.md)
- [Tools, authorization and sessions](docs/framework.md)
- [Animation production and current artwork limits](docs/animation-production.md)
- [Building and publishing release packages](docs/releases.md)
- [Artwork provenance and current license status](NOTICE.md)

## Develop locally

```sh
bun install --frozen-lockfile
bun run check
bun run build
bun run demo:build
python3 -m http.server 8767 --directory site
```

The studio at `http://localhost:8767` uses a local simulated agent. It does not
require model credentials. Run `bun run test:package` and `bun run test:browser`
for the independent-package and browser checks; the browser checks require
Playwright Chromium. See [release verification](docs/releases.md) for the full
sequence.
