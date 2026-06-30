"""The on-demand agent: a manual streaming tool-use loop over Claude.

Yields event dicts the API layer turns into Server-Sent Events:
    {"type": "tool",  "name": ..., "input": {...}}   # a tool is about to run
    {"type": "text",  "text": "..."}                  # streamed answer tokens
    {"type": "done"}                                   # turn finished
    {"type": "error", "message": "..."}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Iterator, List, Optional

import anthropic

from .. import config_store
from .system_prompt import build_system_prompt
from .tools import TOOLS, execute_tool

log = logging.getLogger("agent")

_MAX_ITERATIONS = 8   # safety cap on tool-use rounds per turn
_MAX_TOKENS = 8000


def run_agent_stream(
    message: str,
    history: List[Dict[str, str]],
    user: Optional[Dict[str, Any]] = None,
    focus_account: Optional[str] = None,
) -> Iterator[Dict[str, Any]]:
    api_key = config_store.anthropic_key()
    if not api_key:
        yield {"type": "error", "message": "המפתח של Claude עדיין לא הוגדר — פתח את ההגדרות (⚙) והדבק אותו."}
        return

    client = anthropic.Anthropic(api_key=api_key)
    system = build_system_prompt(user, focus_account)
    messages: List[Dict[str, Any]] = [
        {"role": m["role"], "content": m["content"]}
        for m in history
        if m.get("role") in ("user", "assistant") and m.get("content")
    ]
    messages.append({"role": "user", "content": message})

    try:
        for _ in range(_MAX_ITERATIONS):
            with client.messages.stream(
                model=config_store.anthropic_model(),
                max_tokens=_MAX_TOKENS,
                system=system,
                tools=TOOLS,
                thinking={"type": "adaptive"},
                messages=messages,
            ) as stream:
                for text in stream.text_stream:
                    yield {"type": "text", "text": text}
                final = stream.get_final_message()

            messages.append({"role": "assistant", "content": final.content})

            if final.stop_reason != "tool_use":
                break

            tool_results: List[Dict[str, Any]] = []
            for block in final.content:
                if getattr(block, "type", None) == "tool_use":
                    yield {"type": "tool", "name": block.name, "input": block.input}
                    content, is_error = execute_tool(block.name, block.input or {}, user)
                    result: Dict[str, Any] = {
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": content,
                    }
                    if is_error:
                        result["is_error"] = True
                    tool_results.append(result)
            messages.append({"role": "user", "content": tool_results})
        yield {"type": "done"}
    except anthropic.APIStatusError as e:
        log.exception("Anthropic API error")
        yield {"type": "error", "message": f"שגיאת מודל ({e.status_code}): {e.message}"}
    except Exception as e:  # noqa: BLE001
        log.exception("Agent loop failed")
        yield {"type": "error", "message": f"שגיאה: {e}"}
