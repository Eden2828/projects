"""Configuration loading and validation.

Centralizes all environment-variable parsing and file-based config (clients +
QA rules) so the rest of the codebase reads from a single typed ``Settings``
object instead of touching ``os.environ`` directly.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

# Load variables from a local .env file if present. Real environment variables
# always take precedence over .env values.
load_dotenv()

# Project root = the directory that contains the "app" package.
PROJECT_ROOT = Path(__file__).resolve().parent.parent


# -----------------------------------------------------------------------------
# Small helpers for typed env parsing.
# -----------------------------------------------------------------------------
def _get_str(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def _get_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _get_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    try:
        return float(raw)
    except ValueError:
        return default


def _get_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _resolve_path(value: str) -> Path:
    """Resolve a possibly-relative path against the project root."""
    p = Path(value)
    return p if p.is_absolute() else (PROJECT_ROOT / p)


@dataclass
class Settings:
    """Strongly-typed view of all runtime configuration."""

    # Meta Marketing API (read-only)
    meta_access_token: str
    meta_app_id: str
    meta_app_secret: str
    meta_api_version: str
    meta_min_seconds_between_calls: float
    meta_max_retries: int

    # Supabase
    supabase_url: str
    supabase_service_role_key: str

    # Anthropic
    anthropic_api_key: str
    anthropic_model: str
    use_claude_report: bool

    # Scheduling
    check_interval_minutes: int

    # Data sources
    clients_source: str
    clients_file: Path
    rules_file: Path
    reports_dir: Path

    # Logging
    log_level: str
    log_json: bool

    # Reporting
    export_formats: List[str] = field(default_factory=list)

    # ------------------------------------------------------------------
    @property
    def meta_base_url(self) -> str:
        return f"https://graph.facebook.com/{self.meta_api_version}"

    @property
    def supabase_enabled(self) -> bool:
        return bool(self.supabase_url and self.supabase_service_role_key)

    @property
    def claude_enabled(self) -> bool:
        return bool(self.anthropic_api_key) and self.use_claude_report

    def validate(self) -> List[str]:
        """Return a list of human-readable configuration problems (empty = OK).

        Only Meta credentials are strictly required for a monitoring run.
        Supabase and Claude degrade gracefully (local export / template report).
        """
        problems: List[str] = []
        if not self.meta_access_token:
            problems.append("META_ACCESS_TOKEN is not set (required).")
        if self.clients_source not in {"json", "supabase"}:
            problems.append("CLIENTS_SOURCE must be 'json' or 'supabase'.")
        if self.clients_source == "supabase" and not self.supabase_enabled:
            problems.append(
                "CLIENTS_SOURCE=supabase but Supabase credentials are missing."
            )
        if self.clients_source == "json" and not self.clients_file.exists():
            problems.append(f"Clients file not found: {self.clients_file}")
        return problems


def load_settings() -> Settings:
    """Build a ``Settings`` instance from the current environment."""
    export_formats = [
        fmt.strip().lower()
        for fmt in _get_str("EXPORT_FORMATS", "markdown,csv").split(",")
        if fmt.strip()
    ]

    return Settings(
        meta_access_token=_get_str("META_ACCESS_TOKEN"),
        meta_app_id=_get_str("META_APP_ID"),
        meta_app_secret=_get_str("META_APP_SECRET"),
        meta_api_version=_get_str("META_API_VERSION", "v20.0"),
        meta_min_seconds_between_calls=_get_float("META_MIN_SECONDS_BETWEEN_CALLS", 1.0),
        meta_max_retries=_get_int("META_MAX_RETRIES", 4),
        supabase_url=_get_str("SUPABASE_URL"),
        supabase_service_role_key=_get_str("SUPABASE_SERVICE_ROLE_KEY"),
        anthropic_api_key=_get_str("ANTHROPIC_API_KEY"),
        anthropic_model=_get_str("ANTHROPIC_MODEL", "claude-sonnet-4-6"),
        use_claude_report=_get_bool("USE_CLAUDE_REPORT", True),
        check_interval_minutes=_get_int("CHECK_INTERVAL_MINUTES", 30),
        clients_source=_get_str("CLIENTS_SOURCE", "json").lower(),
        clients_file=_resolve_path(_get_str("CLIENTS_FILE", "clients.json")),
        rules_file=_resolve_path(_get_str("RULES_FILE", "rules.json")),
        reports_dir=_resolve_path(_get_str("REPORTS_DIR", "reports")),
        log_level=_get_str("LOG_LEVEL", "INFO").upper(),
        log_json=_get_bool("LOG_JSON", False),
        export_formats=export_formats,
    )


# -----------------------------------------------------------------------------
# Client + rules file loading.
# -----------------------------------------------------------------------------
# The canonical client fields. ``main.py`` / supabase_client normalize to these.
CLIENT_FIELDS = [
    "client_id",
    "client_name",
    "ad_account_id",
    "monthly_budget",
    "daily_budget",
    "main_goal",
    "target_cpa",
    "target_roas",
    "industry",
    "campaign_type",
    "assigned_ppc_manager",
    "status",
]


def load_clients_from_json(path: Path) -> List[Dict[str, Any]]:
    """Load and lightly normalize the client list from a JSON file."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, list):
        raise ValueError("clients file must contain a JSON array of client objects.")
    return [normalize_client(c) for c in data]


def normalize_client(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure a client dict has every expected field and a normalized account id."""
    client = {key: raw.get(key) for key in CLIENT_FIELDS}
    # Default status to 'active' if missing.
    if not client.get("status"):
        client["status"] = "active"
    # Meta account ids must be prefixed with "act_".
    account = client.get("ad_account_id")
    if account and not str(account).startswith("act_"):
        client["ad_account_id"] = f"act_{account}"
    # Coerce numerics defensively.
    for num_field in ("monthly_budget", "daily_budget", "target_cpa", "target_roas"):
        value = client.get(num_field)
        if value in (None, ""):
            client[num_field] = 0.0
        else:
            try:
                client[num_field] = float(value)
            except (TypeError, ValueError):
                client[num_field] = 0.0
    return client


def load_rules(path: Path) -> Dict[str, Any]:
    """Load the QA rules/thresholds file, falling back to built-in defaults."""
    if not path.exists():
        return dict(DEFAULT_RULES)
    with open(path, "r", encoding="utf-8") as fh:
        rules = json.load(fh)
    # Merge over defaults so a partial rules file still works.
    merged = dict(DEFAULT_RULES)
    merged.update({k: v for k, v in rules.items() if not k.startswith("_")})
    # Preserve client_overrides if present.
    if "client_overrides" in rules:
        merged["client_overrides"] = rules["client_overrides"]
    return merged


def rules_for_client(rules: Dict[str, Any], client_id: Optional[str]) -> Dict[str, Any]:
    """Return effective rules for a client, applying any per-client overrides."""
    effective = {k: v for k, v in rules.items() if k != "client_overrides"}
    overrides = (rules.get("client_overrides") or {}).get(client_id or "", {})
    effective.update(overrides)
    return effective


# Built-in safe defaults (mirror rules.example.json). Used if no rules file exists.
DEFAULT_RULES: Dict[str, Any] = {
    "zero_spend_active_hours": 6,
    "zero_spend_floor": 0.5,
    "spend_no_results_min_spend": 20.0,
    "cpa_over_target_multiplier": 2.0,
    "roas_below_target_ratio": 1.0,
    "roas_min_spend": 50.0,
    "frequency_threshold": 3.0,
    "ctr_floor_percent": 0.7,
    "ctr_min_impressions": 1000,
    "cpm_high_multiplier": 1.75,
    "cpm_min_impressions": 1000,
    "spend_drop_percent": 0.6,
    "cpa_increase_percent": 0.5,
    "budget_cap_warning_ratio": 0.85,
    "tracking_clicks_without_results_min_clicks": 50,
    "client_overrides": {},
}
