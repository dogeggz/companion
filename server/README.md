# Companion Harness (Python)

Install with `uv add companion-harness` once published, or
`uv add ./vendor/companion_harness-0.1.0-py3-none-any.whl` before publication.
Local development: `uv add --editable /path/to/companion/server`.
This package has no framework, database, character, platform or model credentials.

Supply a streaming chat-completions adapter to `Harness(model=...)`, a list of
`Tool(name, description, parameters, execute, read_only=...)`, model options and
optional `Limits` / async `authorize(tool, call, context)`.
`ToolContext` contains server-authenticated identity, session ID and host metadata.
Tool JSON schemas are validated before execution. The host supplies knowledge
retrieval and prompts as messages; the harness never invents platform instructions.

`async for event in harness.run(messages, context=...)` emits text deltas, named
states and tool presentation events. On success it appends exact assistant/tool
messages to the supplied list. On failure/cancel it leaves that list unchanged.
Persist the result only on successful completion, then send the SSE `done` event.
Add new context AFTER prior messages; do not replace earlier system/context messages.
A presentation-only tool can set `requires_followup=False`; business tools default
to feeding their result back to the model. Round/time/size limits are configurable;
reaching them fails explicitly, never silently removes historical messages.

Registered read-only tools are available by default. A write tool is denied unless
the host authorization hook explicitly allows that exact call. That hook is where
the platform checks user permissions and any required, server-verified confirmation.
Never trust an `approved` flag supplied by the model. Call the platform's normal
business services, including their resource-scoped authorization and audit.

ToolCall.idempotency_key identifies the owner/session/call/arguments. The host MUST
use a transaction or its existing idempotency service for writes: cancellation or
network failure cannot undo a tool's side effects. In-run repeated call IDs are
memoized, but this is not a durable exactly-once guarantee across requests.

Checkpoints are optional. `CheckpointCodec(secret)` signs and compresses the active
history for a browser-held single-tab session. It does not encrypt, archive, expire,
or serialize concurrent writers. Use it only for context that user may see. Hosts
needing private context, multi-device sessions or concurrent requests should keep
history on their backend and enforce compare-and-swap revisions / per-session locks.
The same Harness works with either storage strategy. No storage is hard-coded.

Changing a prefix (migration, summarization, retry after an interrupted captured
request) can still create a legitimate gateway fork. Gateway stitching policies
are external to this library. Successful sequential turns preserve exact prefixes.

Tests: `uv run --project server pytest server/tests` from the repository root.
Build: `uv build --wheel server`. The bookstore test proves host independence and
read/write tool registration without importing any platform or sprite package.
