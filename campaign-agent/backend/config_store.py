"""Runtime-editable settings (keys + accounts) written from the in-app UI.

Single source of truth: ``data/settings.json`` (gitignored). Values there
override ``.env``. This lets a non-technical owner paste the API keys and add
accounts from the Settings screen — no file editing.
"""

from __future__ import annotations

import json
import threading
from typing import Any, Dict, List

from . import settings

_FILE = settings.DATA_DIR / "settings.json"
_lock = threading.Lock()


def _looks_placeholder(v: str) -> bool:
    if not v:
        return True
    low = v.strip().lower()
    return (
        low.startswith("your-")
        or low.startswith("sk-ant-...")
        or low in {"change-me", "replace_me", "..."}
    )


def _clean(v: str) -> str:
    return "" if _looks_placeholder(v) else v.strip()


def _load() -> Dict[str, Any]:
    if _FILE.exists():
        try:
            return json.loads(_FILE.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return {}
    return {}


def save_settings(partial: Dict[str, Any]) -> None:
    """Merge non-empty values into settings.json and persist."""
    with _lock:
        data = _load()
        for key in ("anthropic_api_key", "anthropic_model", "meta_access_token"):
            if key in partial and partial[key] is not None:
                val = str(partial[key]).strip()
                if val:  # blank = leave existing untouched
                    data[key] = val
        if "accounts" in partial and partial["accounts"] is not None:
            data["accounts"] = partial["accounts"]
        _FILE.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


# ----- typed getters (file first, then env, ignoring placeholders) -----------
def anthropic_key() -> str:
    return _load().get("anthropic_api_key") or _clean(settings.ANTHROPIC_API_KEY)


def anthropic_model() -> str:
    return _load().get("anthropic_model") or settings.ANTHROPIC_MODEL


def meta_token() -> str:
    return _load().get("meta_access_token") or _clean(settings.META_ACCESS_TOKEN)


def accounts() -> List[Dict[str, Any]]:
    a = _load().get("accounts")
    if a:
        return a
    if settings.ACCOUNTS_FILE.exists():
        try:
            return json.loads(settings.ACCOUNTS_FILE.read_text(encoding="utf-8"))
        except (ValueError, OSError):
            return []
    return []


def status() -> Dict[str, Any]:
    """Safe, secret-free view for the UI."""
    return {
        "has_anthropic": bool(anthropic_key()),
        "has_meta": bool(meta_token()),
        "model": anthropic_model(),
        "accounts": accounts(),
        "configured": bool(anthropic_key() and meta_token() and accounts()),
    }
