import asyncio
from copy import deepcopy

import pytest

from companion_harness import CheckpointCodec, Harness, Limits, Tool, ToolContext, ToolResult


def reply(text=None, calls=None):
    return {
        "choices": [
            {
                "delta": {"content": text, "tool_calls": calls},
                "finish_reason": "tool_calls" if calls else "stop",
            }
        ]
    }


def call(name="lookup", args='{"item":"book"}', id="call-1"):
    return {"index": 0, "id": id, "function": {"name": name, "arguments": args}}


def run(harness, messages, owner="shop-user"):
    async def consume():
        return [
            e async for e in harness.run(messages, context=ToolContext("shopping-session", owner))
        ]

    return asyncio.run(consume())


def test_foreign_platform_read_then_write_and_exact_prefix():
    captured, executed = [], []

    async def execute(args, context, call):
        executed.append((args, context.owner, call.idempotency_key))
        return ToolResult('{"stock":3}')

    async def model(payload):
        captured.append(deepcopy(payload["messages"]))
        n = len(captured)
        yield (
            reply(calls=[call(id="lookup-1")])
            if n == 1
            else (reply(calls=[call("reserve", id="reserve-1")]) if n == 2 else reply("Reserved"))
        )

    schema = {
        "type": "object",
        "properties": {"item": {"type": "string"}},
        "required": ["item"],
        "additionalProperties": False,
    }

    async def authorize(tool, call, context):
        return context.owner == "shop-user" and call.arguments == {"item": "book"}

    h = Harness(
        model=model,
        tools=(
            Tool("lookup", "Stock", schema, execute),
            Tool("reserve", "Reserve", schema, execute, read_only=False),
        ),
        authorize=authorize,
    )
    messages = [
        {"role": "system", "content": "You are a bookstore assistant."},
        {"role": "user", "content": "Reserve a book"},
    ]
    events = run(h, messages)
    assert len(executed) == 2 and len(captured) == 3
    assert all(len(key) == 64 for _, _, key in executed)
    assert captured[1][: len(captured[0])] == captured[0]
    assert captured[2][: len(captured[1])] == captured[1]
    assert messages[-1]["content"] == "Reserved"
    assert {"type": "state", "name": "tool_running"} in events


def test_writes_denied_without_host_authorization():
    async def forbidden(*_):
        pytest.fail("Write executed without host permission")

    seen = []

    async def model(payload):
        seen.append(deepcopy(payload))
        yield reply(calls=[call("buy", "{}")]) if len(seen) == 1 else reply("Please confirm first")

    run(
        Harness(
            model=model, tools=(Tool("buy", "Buy", {"type": "object"}, forbidden, read_only=False),)
        ),
        [],
    )
    assert '"status":"denied"' in seen[1]["messages"][-1]["content"]


@pytest.mark.parametrize("bad", [call("unknown"), call(args='{"item":42}'), call(args="bad-json")])
def test_invalid_tools_never_execute_and_history_is_atomic(bad):
    async def forbidden(*_):
        pytest.fail("Invalid call executed")

    async def model(_):
        yield reply(calls=[bad])

    original = [{"role": "user", "content": "hello"}]
    messages = deepcopy(original)
    h = Harness(
        model=model,
        tools=(
            Tool(
                "lookup",
                "Stock",
                {"type": "object", "properties": {"item": {"type": "string"}}},
                forbidden,
            ),
        ),
    )
    with pytest.raises(ValueError):
        run(h, messages)
    assert messages == original


def test_cancel_does_not_commit_partial_history():
    async def model(_):
        yield {"choices": [{"delta": {"content": "partial"}}]}
        raise asyncio.CancelledError()

    messages = []
    with pytest.raises(asyncio.CancelledError):
        run(Harness(model=model), messages)
    assert messages == []


def test_round_limit_and_no_silent_context_truncation():
    async def execute(*_):
        return ToolResult("ok")

    async def model(_):
        yield reply(calls=[call(args="{}")])

    with pytest.raises(ValueError, match="Unexpected tool"):
        run(
            Harness(
                model=model,
                tools=(Tool("lookup", "Test", {}, execute),),
                limits=Limits(max_rounds=2),
            ),
            [],
        )
    original = [{"role": "user", "content": "x" * 500}]
    with pytest.raises(ValueError, match="full"):
        run(Harness(model=model, limits=Limits(max_context_chars=100)), original)
    assert len(original[0]["content"]) == 500


def test_snapshot_account_session_tamper_and_refresh():
    codec = CheckpointCodec("test-secret")
    messages = [{"role": "assistant", "content": " exact \n"}]
    token = codec.encode("alice", "session", messages)
    assert codec.decode(token, "alice", "session") == messages
    for value, owner, session in [
        (token + "x", "alice", "session"),
        (token, "bob", "session"),
        (token, "alice", "other"),
    ]:
        with pytest.raises(ValueError):
            codec.decode(value, owner, session)
