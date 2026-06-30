"""Central configuration loaded from environment.

Reads ``campaign-agent/.env`` first, then falls back to the repo-root ``.env``
(which already holds ANTHROPIC_API_KEY / META_* on this machine) so you don't
have to duplicate secrets.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

# Project layout
BASE_DIR = Path(__file__).resolve().parent.parent          # .../campaign-agent
ROOT_DIR = BASE_DIR.parent                                  # .../דאשבורד
CONFIG_DIR = BASE_DIR / "config"
FRONTEND_DIR = BASE_DIR / "frontend"
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(exist_ok=True)

# Load env: local first (takes priority), then repo-root as fallback.
load_dotenv(BASE_DIR / ".env")
load_dotenv(ROOT_DIR / ".env", override=False)


def _get(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _get_float(name: str, default: float) -> float:
    try:
        return float(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _get_int(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except (TypeError, ValueError):
        return default


def _get_bool(name: str, default: bool) -> bool:
    return _get(name, str(default)).lower() in {"1", "true", "yes", "on"}


# Anthropic
ANTHROPIC_API_KEY = _get("ANTHROPIC_API_KEY")
ANTHROPIC_MODEL = _get("ANTHROPIC_MODEL", "claude-opus-4-8")

# Meta
META_ACCESS_TOKEN = _get("META_ACCESS_TOKEN")
META_APP_ID = _get("META_APP_ID")
META_APP_SECRET = _get("META_APP_SECRET")
META_API_VERSION = _get("META_API_VERSION", "v20.0")
META_BASE_URL = f"https://graph.facebook.com/{META_API_VERSION}"
META_MIN_SECONDS_BETWEEN_CALLS = _get_float("META_MIN_SECONDS_BETWEEN_CALLS", 1.0)
META_MAX_RETRIES = _get_int("META_MAX_RETRIES", 4)

# Server / auth
PORT = _get_int("PORT", 8000)
SESSION_SECRET = _get("SESSION_SECRET", "dev-insecure-secret-change-me")

# Alerts scan
SCAN_INTERVAL_MINUTES = _get_int("SCAN_INTERVAL_MINUTES", 30)
SCAN_DATE_PRESET = _get("SCAN_DATE_PRESET", "today")
SCHEDULER_ENABLED = _get_bool("SCHEDULER_ENABLED", True)

# General
CURRENCY = _get("CURRENCY", "₪")

# Config file paths (real files; *.example.json are templates)
ACCOUNTS_FILE = CONFIG_DIR / "accounts.json"
USERS_FILE = CONFIG_DIR / "users.json"
RULES_FILE = CONFIG_DIR / "rules.json"
DB_PATH = DATA_DIR / "campaign_agent.db"
