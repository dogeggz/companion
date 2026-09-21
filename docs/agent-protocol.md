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

For POST SSE use `createSSEAgent({ endpoint, body?, headers?, credentials?, fetch? })`. For NDJSON or WebSocket, parse frames in a custom adapter and yield the same `AgentUpdate` objects. Keep conversation history, session IDs,
authentication and server-side credentials in the host/backend. The component
does not prescribe any vendor API. Asset loading is unrelated to agent traffic.

`connectAgent` starts `thinking`, finishes with `success` unless the adapter supplied an explicit supported reaction, and uses `sad` on
failure when the pack contains those names. Override mappings with the third
argument `{ thinking: 'working', success: 'done', error: 'oops' }`. Missing
automatic reactions are skipped. An unknown reaction from the adapter is ignored; direct `controller.react()` still reports unknown reactions. To render errors as friendly text, subscribe to `error` and map
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

## SSE wire format

```text
data: {"type":"delta","text":"Hello"}

data: {"type":"reaction","name":"notification"}

data: {"type":"done"}

```

Each event ends with a blank line. UTF-8 chunks, CRLF and multiline `data:` are
handled; comments are ignored. Finish with `done`; unexpected EOF is an error.
`{"type":"error","message":"…"}` fails the request. Events are bounded to 256 KiB.
Arbitrary `action` events are deliberately not accepted from this network adapter.
Use a custom adapter when host policy authorizes additional commands. Cancellation
passes AbortSignal to fetch and releases the response reader.

## Asset readiness

Views emit bubbling/composed `companion-loading` and `companion-ready` DOM
events with `{ characterId }`. `ready` fires after images are decoded, dimensions
validated and the first frame drawn. Hosts can keep their localized placeholder
until this event. `data-loading`, `data-ready` and `aria-busy` also expose view
readiness. Controller `characterchange` alone does not mean images are ready.


Optional `{"type":"checkpoint","token":"opaque-host-state"}` carries up to 196608
characters of opaque host continuation state. `createSSEAgent({onCheckpoint})`
delivers it only after `done`; truncated/error/aborted streams never commit it.
The core does not decode, store or replay the token. The host chooses account
isolation, verification, persistence, and a request body field for the next turn.

Named lifecycle states use `{"type":"state","name":"tool_running"}` and are mapped via `connectAgent(..., {states: {tool_running: "your-reaction"}})`. State and reaction names are host-defined. `{"type":"metadata","name":"tool-progress","data":{}}` reaches optional `onMetadata` as inert data, never as executable DOM instructions. The server sends `checkpoint` followed by `done` only after a successful turn.


Completion semantics: `thinking` and `tool_running` are transient states by default;
the configured thinking reaction is also transient even if emitted as `reaction`.
A successful stream restores the latest explicit non-transient reaction if a later
progress state covered it, otherwise uses `success` (set `success: "idle"` for a
neutral completion). Configure `transientStates` / `transientReactions` for custom
names. Completed one-shot emotions are not replayed unless a later progress state
covered them. Cancellation clears only progress still owned by that request.
