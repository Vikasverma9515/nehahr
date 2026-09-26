"""A scripted LLM for agent tests: no network, deterministic replies and tool calls."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field

from livekit.agents import llm
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS, APIConnectOptions


@dataclass
class Turn:
    text: str = ""
    tool_calls: list[tuple[str, dict]] = field(default_factory=list)


class ScriptedLLM(llm.LLM):
    """Each chat() call consumes the next scripted Turn (or a function of the chat context)."""

    def __init__(self, script: list[Turn | Callable[[llm.ChatContext], Turn]]):
        super().__init__()
        self.script = list(script)
        self.calls: list[llm.ChatContext] = []
        self.seen_tools: list[list[str]] = []

    @property
    def model(self) -> str:
        return "scripted"

    def chat(self, *, chat_ctx, tools=None, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS, **_):
        self.calls.append(chat_ctx.copy())
        self.seen_tools.append([getattr(t, "info", t).name for t in (tools or []) if hasattr(getattr(t, "info", t), "name")])
        step = self.script.pop(0) if self.script else Turn(text="Okay.")
        turn = step(chat_ctx) if callable(step) else step
        return _Stream(self, chat_ctx=chat_ctx, tools=tools or [], conn_options=conn_options, turn=turn)


class _Stream(llm.LLMStream):
    def __init__(self, llm_: ScriptedLLM, *, chat_ctx, tools, conn_options, turn: Turn):
        super().__init__(llm_, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)
        self._turn = turn

    async def _run(self) -> None:
        if self._turn.text:
            self._event_ch.send_nowait(llm.ChatChunk(
                id="c1", delta=llm.ChoiceDelta(role="assistant", content=self._turn.text)))
        calls = [
            llm.FunctionToolCall(name=name, arguments=json.dumps(args), call_id=f"call_{i}")
            for i, (name, args) in enumerate(self._turn.tool_calls)
        ]
        if calls:
            self._event_ch.send_nowait(llm.ChatChunk(
                id="c2", delta=llm.ChoiceDelta(role="assistant", tool_calls=calls)))
