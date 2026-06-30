"""Pydantic request/response models for the API layer.

Snapshots and findings flow as plain dicts (ported from the proven engine);
these models only cover the HTTP boundary.
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel


class LoginRequest(BaseModel):
    username: str
    password: str


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str
    account: Optional[str] = None          # account id/name in focus (optional)
    history: List[ChatMessage] = []
