# Communication and agent adapters

The controller is a small UI state machine. It can be driven by job events,
chat, workflow status, a local script, or an agent. It performs no tool calls or
model requests itself.

## Commands and events

| API | Meaning |
| --- | --- |
| `react(name, { loop?, returnTo? })` | Start/restart any configured reaction; returns false for an unknown name |
| `say(text)` | Replace the text bubble; empty text hides it |
| `ask(text)` | Emit a user request; blank requests are ignored |
| `action(name, data?)` | Emit a custom host action |
| `pause()` / `resume()` | Freeze/resume animation; does not pause a network request |
| `setCharacter(pack)` | Validate/replace character and reset its reaction/text |
| `clearCharacter()` | Remove artwork and clear the bubble |
| `send(command)` | Serializable commands: react, say, ask, action, pause, resume, clear |
| `getSnapshot()` / `subscribe(fn)` | Read/observe immutable state; unsubscribe with returned function |
| `on(event, fn)` | Subscribe to typed events; returns unsubscribe |

Events: `statechange`, `characterchange`, `message`, `request`, `action`,
`complete`, `error`. A connected web component also dispatches DOM CustomEvents
named `companion-<event>`, with the same payload in `event.detail`; events bubble
through Shadow DOM. React/Vue hosts can subscribe directly to the controller.
Each view should normally own one controller unless synchronized views are
intentional.

## Adapter contract

```ts
type AgentAdapter = (request: {
  text: string
  requestId: number
  signal: AbortSignal
}) => AsyncIterable<AgentUpdate>

type AgentUpdate =
  | { type: 'text'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'reaction'; name: string }
  | { type: 'action'; name: string; data?: unknown }
```

Use an async generator for a simple JSON endpoint:

```ts
import { connectAgent } from '@companion-kit/core'

const connection = connectAgent(companion, async function* ({ text, signal }) {
  const response = await fetch('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: text }),
    signal,
  })
  if (!response.ok) throw new Error(`Agent request failed: ${response.status}`)
  const data = await response.json()
  if (typeof data.text !== 'string') throw new Error('Expected a text response')
  yield { type: 'text', text: data.text }
})

companion.ask('Explain the result')
// On host teardown:
connection.disconnect()
```

For SSE, NDJSON or WebSocket, parse that transport's frames in the adapter and
yield the same `AgentUpdate` objects. Keep conversation history, session IDs,
authentication and server-side credentials in the host/backend. The component
does not prescribe any vendor API. Asset loading is unrelated to agent traffic.

`connectAgent` starts `thinking`, finishes with `success`, and uses `sad` on
failure when the pack contains those names. Override mappings with the third
argument `{ thinking: 'working', success: 'done', error: 'oops' }`. Missing
automatic reactions are skipped. An explicit unknown reaction from the adapter
emits an error. To render errors as friendly text, subscribe to `error` and map
the message in the host.

New requests abort old ones and ignore late updates even when a transport fails
to honor abort. `cancel()` stops the current stream and returns an active
thinking state to idle. Character changes cancel the active request.
`disconnect()` cancels and removes listeners; the host owns this lifecycle
because the same controller can outlive an individual view. Animation pausing
does not cancel requests. The binding never silently connects to a remote URL.

Completion callbacks describe animation only. Reduced motion preserves logical
completion while showing a static poster; hidden tabs pause the animation
clock. Do not use the animation clock to determine business task success.

## Framework integration references

The interoperability approach follows browser custom elements and standard
events: [Vue custom elements](https://vuejs.org/guide/extras/web-components),
[React custom HTML elements](https://react.dev/reference/react-dom/components#custom-html-elements),
and [Shadow DOM](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM).
