"""Minimal internal auth: username/password from config/users.json + cookie sessions.

This is an internal-only tool (campaigners + owner). Passwords are stored as
PBKDF2-HMAC-SHA256 hashes; sessions are in-memory tokens set as an httpOnly
cookie. Restarting the server logs everyone out — acceptable for this tool.

Generate a password hash:
    python -m backend.auth hash "my-password"
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import sys
from typing import Any, Dict, Optional

from . import settings

_PBKDF2_ROUNDS = 200_000
_sessions: Dict[str, Dict[str, Any]] = {}  # token -> user dict (without hash)


def hash_password(password: str, *, salt: Optional[str] = None) -> str:
    salt = salt or secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, rounds, salt, hexdigest = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), int(rounds))
        return hmac.compare_digest(dk.hex(), hexdigest)
    except (ValueError, AttributeError):
        return False


def _load_users() -> list[dict]:
    if not settings.USERS_FILE.exists():
        return []
    try:
        return json.loads(settings.USERS_FILE.read_text(encoding="utf-8"))
    except (ValueError, OSError):
        return []


def authenticate(username: str, password: str) -> Optional[Dict[str, Any]]:
    for u in _load_users():
        if u.get("username") == username and verify_password(password, u.get("password_hash", "")):
            return {k: v for k, v in u.items() if k != "password_hash"}
    return None


def create_session(user: Dict[str, Any]) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = user
    return token


def get_session(token: Optional[str]) -> Optional[Dict[str, Any]]:
    if not token:
        return None
    return _sessions.get(token)


def destroy_session(token: Optional[str]) -> None:
    if token:
        _sessions.pop(token, None)


if __name__ == "__main__":
    if len(sys.argv) == 3 and sys.argv[1] == "hash":
        print(hash_password(sys.argv[2]))
    else:
        print('usage: python -m backend.auth hash "your-password"')
