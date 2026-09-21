from __future__ import annotations

import asyncio
import hashlib
import json
import re
from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
from copy import deepcopy
from dataclasses import dataclass, field
from typing import Any

from jsonschema import Draft202012Validator

Event = dict[str, Any]
Model = Callable[[dict], AsyncIterator[dict]]


@dataclass(frozen=True)
class ToolContext:
    session_id: str
    owner: str
    # Authenticated host data. Never populated from model-generated arguments.
    metadata: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ToolCall:
    id: str
    name: str
    arguments: dict
    idempotency_key: str


@dataclass(frozen=True)
class ToolResult:
    content: str
    events: tuple[Event, ...] = ()


@dataclass(frozen=True)
class Tool:
    name: str
    description: str
    parameters: dict
    execute: Callable[[dict, ToolContext, ToolCall], Awaitable[ToolResult]]
    read_only: bool = True
    # Presentation-only tools may finish alongside text without another model round.
    requires_followup: bool = True

    def definition(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


@dataclass(frozen=True)
class Limits:
    max_rounds: int = 8
    max_calls_per_round: int = 8
    max_context_chars: int = 200_000
    max_text_chars: int = 8_000
    max_reasoning_chars: int = 16_000
    max_argument_chars: int = 8_000
    max_result_chars: int = 16_000
    timeout_seconds: float = 180


class Harness:
    """Append-only wire history; no prompt, model vendor or platform tools are built in.

    Consume the stream to completion before committing ``messages`` to a session store.
    Errors/cancellation never mutate the supplied list. Hosts own durable concurrency,
    tool permission/confirmation checks and transactional idempotency for side effects.
    """

    def __init__(
        self,
        *,
        model: Model,
        tools: tuple[Tool, ...] = (),
        limits: Limits | None = None,
        model_options: dict | None = None,
        authorize: Callable[[Tool, ToolCall, ToolContext], Awaitable[bool]] | None = None,
    ):
        limits = limits or Limits()
        if limits.max_rounds < 1 or limits.max_calls_per_round < 1 or limits.timeout_seconds <= 0:
            raise ValueError("Invalid harness limits")
        self.model, self.limits, self.authorize = model, limits, authorize
        self.options = deepcopy(model_options or {})
        if set(self.options) & {"messages", "tools", "tool_choice", "stream"}:
            raise ValueError("Model options may not override harness-owned fields")
        self.tools = {t.name: t for t in tools}
        if len(self.tools) != len(tools):
            raise ValueError("Duplicate tool names")
        for tool in tools:
            if not re.fullmatch(r"[A-Za-z0-9_-]{1,64}", tool.name):
                raise ValueError("Invalid tool name")
            Draft202012Validator.check_schema(tool.parameters)
        self.validators = {t.name: Draft202012Validator(t.parameters) for t in tools}

    async def run(self, messages: list[dict], *, context: ToolContext) -> AsyncIterator[Event]:
        wire = deepcopy(messages)
        results: dict[str, tuple[str, ToolResult]] = {}
        force_text = False
        async with asyncio.timeout(self.limits.timeout_seconds):
            for turn in range(self.limits.max_rounds):
                if len(json.dumps(wire, ensure_ascii=False)) > self.limits.max_context_chars:
                    raise ValueError("Conversation is full; start a new conversation.")
                payload = {**self.options, "messages": deepcopy(wire), "stream": True}
                if self.tools:
                    payload.update(
                        tools=[t.definition() for t in self.tools.values()],
                        tool_choice="none"
                        if force_text or turn == self.limits.max_rounds - 1
                        else "auto",
                    )
                yield {"type": "state", "name": "thinking"}
                calls: dict[int, dict] = {}
                text = reasoning = ""
                finished = False
                async for event in self.model(payload):
                    choices = event.get("choices", [])
                    if not choices:
                        continue
                    choice = choices[0]
                    if choice.get("finish_reason"):
                        if choice["finish_reason"] not in ("stop", "tool_calls"):
                            raise ValueError("Incomplete model reply")
                        finished = True
                    delta = choice.get("delta", {})
                    if delta.get("content"):
                        value = delta["content"]
                        if not isinstance(value, str):
                            raise ValueError("Invalid model text")
                        text += value
                        if len(text) > self.limits.max_text_chars:
                            raise ValueError("Model text too large")
                        yield {"type": "delta", "text": value}
                    if delta.get("reasoning_content"):
                        reasoning += delta["reasoning_content"]
                        if len(reasoning) > self.limits.max_reasoning_chars:
                            raise ValueError("Model reasoning too large")
                    for fragment in delta.get("tool_calls") or []:
                        index = fragment.get("index", 0)
                        if (
                            not isinstance(index, int)
                            or not 0 <= index < self.limits.max_calls_per_round
                        ):
                            raise ValueError("Too many tool calls")
                        call = calls.setdefault(
                            index,
                            {
                                "id": "",
                                "type": "function",
                                "function": {"name": "", "arguments": ""},
                            },
                        )
                        call["id"] += fragment.get("id") or ""
                        if len(call["id"]) > 256:
                            raise ValueError("Tool call id too large")
                        for key in ("name", "arguments"):
                            call["function"][key] += fragment.get("function", {}).get(key) or ""
                            if len(call["function"][key]) > self.limits.max_argument_chars:
                                raise ValueError("Tool call too large")
                if not finished:
                    raise ValueError("Missing completion")
                if calls and (not self.tools or payload.get("tool_choice") == "none"):
                    raise ValueError("Unexpected tool call")
                assistant: dict = {"role": "assistant", "content": text or None}
                if reasoning:
                    assistant["reasoning_content"] = reasoning
                if calls:
                    assistant["tool_calls"] = list(calls.values())
                wire.append(assistant)
                # Validate every call before executing any of this round's tools.
                validated = []
                for raw in calls.values():
                    name = raw["function"]["name"]
                    tool = self.tools.get(name)
                    if tool is None:
                        raise ValueError("Unknown tool")
                    args = json.loads(raw["function"]["arguments"])
                    if not isinstance(args, dict) or not self.validators[name].is_valid(args):
                        raise ValueError("Invalid tool arguments")
                    if not raw["id"]:
                        raise ValueError("Missing tool call id")
                    identity = json.dumps(
                        [context.owner, context.session_id, raw["id"], name, args], sort_keys=True
                    )
                    key = hashlib.sha256(identity.encode()).hexdigest()
                    validated.append((tool, ToolCall(raw["id"], name, args, key)))
                for tool, call in validated:
                    # A write requires an explicit host authorization decision, even if registered.
                    allowed = (
                        await self.authorize(tool, call, context)
                        if self.authorize
                        else tool.read_only
                    )
                    if not allowed:
                        result = ToolResult(
                            '{"status":"denied","message":"Host authorization or user confirmation required."}'
                        )
                    elif call.id in results:
                        old_key, result = results[call.id]
                        if old_key != call.idempotency_key:
                            raise ValueError("Tool call id reused with different arguments")
                    else:
                        yield {"type": "state", "name": "tool_running"}
                        result = await tool.execute(deepcopy(call.arguments), context, call)
                        if (
                            not isinstance(result, ToolResult)
                            or len(result.content) > self.limits.max_result_chars
                        ):
                            raise ValueError("Invalid or oversized tool result")
                        results[call.id] = (call.idempotency_key, result)
                    wire.append(
                        {"role": "tool", "tool_call_id": call.id, "content": result.content}
                    )
                    for event in result.events:
                        if event.get("type") not in ("reaction", "state", "metadata"):
                            raise ValueError("Tools may only emit presentation metadata")
                        yield event
                if text.strip() and (
                    not validated or all(not t.requires_followup for t, _ in validated)
                ):
                    if len(json.dumps(wire, ensure_ascii=False)) > self.limits.max_context_chars:
                        raise ValueError("Conversation is full; start a new conversation.")
                    messages[:] = wire
                    yield {"type": "state", "name": "completed"}
                    return
                if not validated:
                    raise ValueError("Empty model reply")
                force_text = all(not t.requires_followup for t, _ in validated)
            raise ValueError("Tool round limit reached")
