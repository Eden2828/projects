"""FastAPI app: auth, accounts, chat (SSE), alerts, and static frontend."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from fastapi import Body, Cookie, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles

from . import auth, config_store, db, settings
from .agent.runtime import run_agent_stream
from .alerts import scheduler
from .connectors import base
from .connectors.meta import MetaClient
from .models import ChatRequest, LoginRequest

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("main")

app = FastAPI(title="Campaign Agent", docs_url=None, redoc_url=None)

SESSION_COOKIE = "ca_session"


def _lan_ip() -> str:
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:  # noqa: BLE001
        return "127.0.0.1"


@app.on_event("startup")
def _startup() -> None:
    db.init_db()
    scheduler.start_scheduler()
    ip = _lan_ip()
    log.info("=" * 56)
    log.info(" Campaign Agent פועל!")
    log.info(" במחשב הזה:        http://localhost:8000")
    log.info(" לקמפיינרים ברשת:  http://%s:8000", ip)
    log.info("=" * 56)


@app.on_event("shutdown")
def _shutdown() -> None:
    scheduler.shutdown_scheduler()


# ----------------------------------------------------------------------------
# Auth
# ----------------------------------------------------------------------------
def current_user(ca_session: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    user = auth.get_session(ca_session)
    if not user:
        raise HTTPException(status_code=401, detail="לא מחובר")
    return user


@app.post("/api/login")
def login(body: LoginRequest, response: Response) -> Dict[str, Any]:
    user = auth.authenticate(body.username, body.password)
    if not user:
        raise HTTPException(status_code=401, detail="שם משתמש או סיסמה שגויים")
    token = auth.create_session(user)
    response.set_cookie(
        SESSION_COOKIE, token, httponly=True, samesite="lax", max_age=60 * 60 * 24 * 7
    )
    return {"user": user}


@app.post("/api/logout")
def logout(response: Response, ca_session: Optional[str] = Cookie(default=None)) -> Dict[str, Any]:
    auth.destroy_session(ca_session)
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}


def admin_user(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="רק מנהל יכול לשנות הגדרות")
    return user


@app.get("/api/me")
def me(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    return {"user": user}


# ----------------------------------------------------------------------------
# Settings (in-app config) — admin only
# ----------------------------------------------------------------------------
@app.get("/api/config")
def get_config(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    st = config_store.status()
    st["is_admin"] = user.get("role") == "admin"
    return st


@app.post("/api/config")
def save_config(
    body: Dict[str, Any] = Body(default={}),
    user: Dict[str, Any] = Depends(admin_user),
) -> Dict[str, Any]:
    config_store.save_settings(body)
    return config_store.status()


@app.post("/api/config/test")
def test_config(user: Dict[str, Any] = Depends(admin_user)) -> Dict[str, Any]:
    import anthropic

    result: Dict[str, Any] = {"anthropic": {"ok": False}, "meta": {"ok": False}}

    key = config_store.anthropic_key()
    if not key:
        result["anthropic"]["error"] = "מפתח Claude לא הוגדר"
    else:
        try:
            anthropic.Anthropic(api_key=key).models.list(limit=1)
            result["anthropic"]["ok"] = True
        except Exception as e:  # noqa: BLE001
            result["anthropic"]["error"] = str(e)[:200]

    token = config_store.meta_token()
    if not token:
        result["meta"]["error"] = "טוקן Meta לא הוגדר"
    else:
        try:
            who = MetaClient(access_token=token).verify_token()
            result["meta"]["ok"] = True
            result["meta"]["name"] = who.get("name")
        except Exception as e:  # noqa: BLE001
            result["meta"]["error"] = str(e)[:200]

    return result


# ----------------------------------------------------------------------------
# Accounts & alerts
# ----------------------------------------------------------------------------
@app.get("/api/accounts")
def accounts(user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    open_counts = db.count_open_by_account()
    out = []
    for a in base.accounts_for_user(user):
        aid = a.get("client_id") or a.get("ad_account_id")
        out.append({
            "id": a.get("client_id"),
            "name": a.get("client_name"),
            "platform": a.get("platform", "meta"),
            "status": a.get("status"),
            "open_alerts": open_counts.get(aid, 0),
        })
    return {"accounts": out}


@app.get("/api/alerts")
def alerts(
    account: Optional[str] = None,
    status: str = "open",
    user: Dict[str, Any] = Depends(current_user),
) -> Dict[str, Any]:
    account_id = None
    if account:
        resolved = base.resolve_account(account, user)
        account_id = (resolved.get("client_id") or resolved.get("ad_account_id")) if resolved else account
    return {"alerts": db.list_alerts(account_id, status=status)}


@app.post("/api/alerts/{alert_id}/ack")
def ack_alert(alert_id: int, user: Dict[str, Any] = Depends(current_user)) -> Dict[str, Any]:
    ok = db.acknowledge_alert(alert_id)
    if not ok:
        raise HTTPException(status_code=404, detail="התראה לא נמצאה או כבר טופלה")
    return {"ok": True}


@app.post("/api/alerts/refresh")
def refresh_alerts(
    body: Dict[str, Any] = Body(default={}),
    user: Dict[str, Any] = Depends(current_user),
) -> Dict[str, Any]:
    """Run a scan now. Optional {"account": "..."} scans a single account."""
    account_q = body.get("account")
    if account_q:
        acc = base.resolve_account(account_q, user)
        if not acc:
            raise HTTPException(status_code=404, detail="לא נמצא חשבון תואם")
        return {"results": [scheduler.scan_account(acc)]}
    return {"results": scheduler.scan_all()}


# ----------------------------------------------------------------------------
# Chat (SSE streaming)
# ----------------------------------------------------------------------------
@app.post("/api/chat")
def chat(req: ChatRequest, user: Dict[str, Any] = Depends(current_user)) -> StreamingResponse:
    focus_name = None
    if req.account:
        resolved = base.resolve_account(req.account, user)
        focus_name = resolved.get("client_name") if resolved else req.account

    history = [{"role": m.role, "content": m.content} for m in req.history][-12:]
    username = user.get("username", "?")

    def event_stream():
        answer_parts = []
        db.save_chat(username, req.account, "user", req.message)
        for event in run_agent_stream(req.message, history, user, focus_name):
            if event.get("type") == "text":
                answer_parts.append(event["text"])
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        if answer_parts:
            db.save_chat(username, req.account, "assistant", "".join(answer_parts))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ----------------------------------------------------------------------------
# Static frontend (mounted last so /api/* routes win)
# ----------------------------------------------------------------------------
app.mount("/", StaticFiles(directory=str(settings.FRONTEND_DIR), html=True), name="frontend")
