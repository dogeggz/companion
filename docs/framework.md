# Framework and host responsibilities

Companion is a configurable character and agent runtime. A host defines what its
assistant knows, can do, and may do for the current user. No platform prompt,
knowledge corpus, business API, model endpoint or credential is built into the
framework. Adding tools does not require modifying the renderer or its reactions.

| Layer | Install | Extension points |
| --- | --- | --- |
| Browser runtime | `@companion-kit/core` | CharacterPack, arbitrary reaction names, state → reaction mapping, motion targets, custom AgentAdapter |
| Optional artwork | Selected `@companion-kit/character-*` packages | Replace PNG atlas/frames, timing, default/movement/peek reactions |
| Stream client | `createSSEAgent` | Endpoint, auth headers, request body, sources, inert metadata, completed checkpoints |
| Server runtime | Python `companion-harness` under `server/` | Model adapter, tool registry, JSON schemas, permission callback, model options and resource limits |
| Platform integration | Host application | Authentication, system prompt, retrieval, live data access, tools, approval UX, audit, durable storage and idempotency |

The server package is optional and is not bundled into browser code. The initial
server implementation is Python; a Node/Go/Java backend can serve the same SSE
protocol or call a Python service. A browser package alone cannot execute trusted
server tools. Neither package has been published to a public registry yet; actual
`.tgz` and `.whl` files can be installed locally or supplied in releases.

## Browser integration

```ts
import { createCompanion, connectAgent, createSSEAgent } from '@companion-kit/core'
import character from '@companion-kit/character-dogegg'

const companion = createCompanion(character)
let checkpoint: string | undefined
const adapter = createSSEAgent({
  endpoint: '/api/assistant/chat',
  credentials: 'include',
  body: text => ({ text, continuation: checkpoint }),
  onCheckpoint: token => { checkpoint = token },
})
const binding = connectAgent(companion, adapter, {
  states: { thinking: 'thinking', tool_running: 'notification' },
})
companion.ask('How can you help?')
// On disposal: binding.disconnect()
```

The host chooses persistence per authenticated account/session and supplies a
stable session ID. The example holds state only in memory. A custom CharacterPack
can name reactions `reading`, `celebrate` or anything else and map states to them;
those names never become business authority. Framework, React and Vue consumers
share the same core; adapters do not implement another agent loop.

## Server integration

```python
from companion_harness import Harness, Tool, ToolContext, ToolResult

async def lookup(arguments, context, call):
    # Use the host's existing authenticated business service.
    row = await catalog.lookup(context.owner, arguments['item'])
    return ToolResult(row.to_json())

harness = Harness(
    model=stream_model,  # async iterator of chat-completion deltas; host owns network/auth
    model_options={'model': 'host-selected-model', 'max_tokens': 4096},
    tools=(Tool('lookup', 'Look up one item', {
        'type': 'object', 'properties': {'item': {'type': 'string'}},
        'required': ['item'], 'additionalProperties': False,
    }, lookup),),
    authorize=host_authorize,
)
# Load the exact previous wire history, or start with the HOST system prompt.
messages += [{'role': 'user', 'content': current_context},
             {'role': 'user', 'content': question}]
async for event in harness.run(messages, context=ToolContext(session_id, user_id)):
    yield event
# Commit messages to host storage or encode a CheckpointCodec token, then send done.
```

`catalog`, `stream_model`, `host_authorize` and session storage are host-owned
adapters. See `server/tests/test_harness.py` for a complete executable bookstore
consumer with fake inference and independently registered read/write tools.

Writes (`read_only=False`) require the authorization callback to explicitly allow
the exact arguments for the authenticated user. The host owns confirmation UI,
server-side approval verification, resource permission checks and durable
idempotency. The framework gives each call an idempotency key; it cannot make an
arbitrary external API exactly-once or roll back an already executed operation.

## Linear sessions and boundaries

Successful turns append raw assistant text, tool calls/results and new context.
Earlier system prompts, context and assistant whitespace are not rewritten.
Changing the character can be a new appended context item; it need not replace the
first prompt. Resource limits are configurable; exhaustion is explicit, not a
silent history truncation that changes the trajectory prefix.

`CheckpointCodec` is one optional single-tab persistence strategy. It signs and
compresses state but does not encrypt it. The host must not put server-only data
there. A database-backed session with revision compare-and-swap is appropriate
for multiple tabs/devices, concurrent requests or private internal context. The
runtime consumes the same message list either way; there is no mandatory DB.

Canceled/failed requests do not commit a successful client checkpoint. A gateway
may still have captured a partial request and represent a later retry as a fork;
that is different from rewriting every successful turn. Existing old captures
cannot be retroactively repaired by changing the library. Context summarization,
if added by a host, must be an explicit boundary with trace lineage.

Current scope includes model/tool loops, schemas, authorization hooks, limits,
cancellation, state mapping and optional signed snapshots. It does not yet provide
built-in approval UI, a durable job scheduler, MCP adapters, vector databases,
multi-agent orchestration or an exactly-once distributed session store. These can
be host integrations or future modules without adding platform-specific logic to
the sprite renderer.
