"use strict";

const $ = (sel) => document.querySelector(sel);
const state = { user: null, account: "", history: [], streaming: false };

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------
async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (res.status === 401) {
    showLogin();
    throw new Error("unauthorized");
  }
  return res;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
function showLogin() {
  $("#app").classList.add("hidden");
  $("#login-screen").classList.remove("hidden");
}
function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
}

async function checkAuth() {
  try {
    const res = await fetch("/api/me");
    if (!res.ok) return showLogin();
    const data = await res.json();
    state.user = data.user;
    onAuthed();
  } catch {
    showLogin();
  }
}

$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("#login-error").textContent = "";
  try {
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: $("#login-user").value, password: $("#login-pass").value }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      $("#login-error").textContent = err.detail || "כניסה נכשלה";
      return;
    }
    const data = await res.json();
    state.user = data.user;
    onAuthed();
  } catch {
    $("#login-error").textContent = "שגיאת רשת";
  }
});

$("#logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  state.user = null;
  showLogin();
});

function onAuthed() {
  showApp();
  $("#user-name").textContent = state.user.display_name || state.user.username;
  loadAccounts();
  loadAlerts();
  checkConfig();
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
async function checkConfig() {
  try {
    const res = await api("/api/config");
    const cfg = await res.json();
    $("#settings-btn").classList.toggle("hidden", !cfg.is_admin);
    if (cfg.is_admin && !cfg.configured) {
      openSettings(true);
    }
  } catch {}
}

async function openSettings(firstTime = false) {
  $("#settings-intro").classList.toggle("hidden", !firstTime);
  $("#cfg-status").innerHTML = "";
  try {
    const res = await api("/api/config");
    const cfg = await res.json();
    $("#cfg-anthropic").value = "";
    $("#cfg-anthropic").placeholder = cfg.has_anthropic ? "מוגדר ✓ (השאר ריק כדי לא לשנות)" : "הדבק כאן את מפתח Claude";
    $("#cfg-meta").value = "";
    $("#cfg-meta").placeholder = cfg.has_meta ? "מוגדר ✓ (השאר ריק כדי לא לשנות)" : "הדבק כאן את הטוקן של Meta";
    $("#cfg-model").value = cfg.model || "claude-opus-4-8";
    renderAccountRows(cfg.accounts || []);
  } catch {}
  $("#settings-overlay").classList.remove("hidden");
}

function closeSettings() { $("#settings-overlay").classList.add("hidden"); }

function accountRow(a = {}) {
  const row = document.createElement("div");
  row.className = "acct-row";
  row.innerHTML = `
    <input class="f-name" placeholder="שם הלקוח" value="${esc(a.client_name || "")}" />
    <input class="f-acct" placeholder="act_123456789" value="${esc(a.ad_account_id || "")}" />
    <input class="f-budget" type="number" placeholder="תקציב חודשי" value="${a.monthly_budget ?? ""}" />
    <input class="f-cpa" type="number" placeholder="יעד CPA" value="${a.target_cpa ?? ""}" />
    <input class="f-roas" type="number" placeholder="יעד ROAS" value="${a.target_roas ?? ""}" />
    <button class="rm" title="הסר">✕</button>`;
  row.dataset.clientId = a.client_id || "";
  row.querySelector(".rm").addEventListener("click", () => row.remove());
  return row;
}

function renderAccountRows(accounts) {
  const box = $("#cfg-accounts");
  box.innerHTML = "";
  (accounts.length ? accounts : [{}]).forEach((a) => box.appendChild(accountRow(a)));
}

function collectAccounts() {
  const rows = [...document.querySelectorAll("#cfg-accounts .acct-row")];
  const out = [];
  rows.forEach((row, i) => {
    const name = row.querySelector(".f-name").value.trim();
    const acct = row.querySelector(".f-acct").value.trim();
    if (!name && !acct) return;
    const num = (sel) => {
      const v = parseFloat(row.querySelector(sel).value);
      return isNaN(v) ? 0 : v;
    };
    out.push({
      client_id: row.dataset.clientId || `acc_${Date.now()}_${i}`,
      client_name: name,
      platform: "meta",
      ad_account_id: acct,
      monthly_budget: num(".f-budget"),
      target_cpa: num(".f-cpa"),
      target_roas: num(".f-roas"),
      status: "active",
    });
  });
  return out;
}

function buildConfigBody() {
  const body = { accounts: collectAccounts(), anthropic_model: $("#cfg-model").value };
  const ak = $("#cfg-anthropic").value.trim();
  const mt = $("#cfg-meta").value.trim();
  if (ak) body.anthropic_api_key = ak;
  if (mt) body.meta_access_token = mt;
  return body;
}

$("#settings-btn").addEventListener("click", () => openSettings(false));
$("#settings-close").addEventListener("click", closeSettings);
$("#cfg-add-account").addEventListener("click", () => $("#cfg-accounts").appendChild(accountRow()));

$("#cfg-save").addEventListener("click", async () => {
  const btn = $("#cfg-save");
  btn.disabled = true;
  try {
    await api("/api/config", { method: "POST", body: JSON.stringify(buildConfigBody()) });
    $("#cfg-status").innerHTML = '<span class="ok">✓ נשמר</span>';
    loadAccounts();
    setTimeout(closeSettings, 700);
  } catch {
    $("#cfg-status").innerHTML = '<span class="bad">שמירה נכשלה</span>';
  } finally {
    btn.disabled = false;
  }
});

$("#cfg-test").addEventListener("click", async () => {
  const btn = $("#cfg-test");
  btn.disabled = true;
  $("#cfg-status").textContent = "שומר ובודק…";
  try {
    await api("/api/config", { method: "POST", body: JSON.stringify(buildConfigBody()) });
    const res = await api("/api/config/test", { method: "POST" });
    const r = await res.json();
    const line = (label, x) =>
      x.ok ? `<div><span class="ok">✓ ${label} עובד</span>${x.name ? " (" + esc(x.name) + ")" : ""}</div>`
           : `<div><span class="bad">✕ ${label}:</span> ${esc(x.error || "נכשל")}</div>`;
    $("#cfg-status").innerHTML = line("Claude", r.anthropic) + line("Meta", r.meta);
    loadAccounts();
  } catch {
    $("#cfg-status").innerHTML = '<span class="bad">הבדיקה נכשלה</span>';
  } finally {
    btn.disabled = false;
  }
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
async function loadAccounts() {
  try {
    const res = await api("/api/accounts");
    const data = await res.json();
    const sel = $("#account-select");
    sel.innerHTML = '<option value="">— כל החשבונות —</option>';
    for (const a of data.accounts) {
      const opt = document.createElement("option");
      opt.value = a.id;
      const badge = a.open_alerts ? ` (${a.open_alerts} התראות)` : "";
      opt.textContent = `${a.name}${badge}`;
      sel.appendChild(opt);
    }
  } catch {}
}

$("#account-select").addEventListener("change", (e) => {
  state.account = e.target.value;
  loadAlerts();
});

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
async function loadAlerts() {
  const list = $("#alerts-list");
  list.innerHTML = '<div class="alerts-loading">טוען…</div>';
  try {
    const q = state.account ? `?account=${encodeURIComponent(state.account)}` : "";
    const res = await api(`/api/alerts${q}`);
    const data = await res.json();
    renderAlerts(data.alerts || []);
  } catch {
    list.innerHTML = '<div class="alerts-empty">שגיאה בטעינת התראות</div>';
  }
}

function renderAlerts(alerts) {
  const list = $("#alerts-list");
  if (!alerts.length) {
    list.innerHTML = '<div class="alerts-empty">אין התראות פתוחות 🎉</div>';
    return;
  }
  list.innerHTML = "";
  for (const a of alerts) {
    const card = document.createElement("div");
    card.className = `alert-card ${a.severity}`;
    card.innerHTML = `
      <div class="alert-meta"><span class="sev-badge ${a.severity}">${a.severity}</span> ${esc(a.client_name || "")}</div>
      <div class="alert-title">${esc(a.title || "")}</div>
      <div class="alert-expl">${esc(a.explanation || "")}</div>
      <div class="alert-step"><b>צעד מומלץ:</b> ${esc(a.recommended_next_step || "")}</div>
      <div class="alert-actions">
        <button data-ack="${a.id}">✓ סמן כטופל</button>
        <button data-ask="${esc(a.title || "")}">שאל את ה-Agent</button>
      </div>`;
    list.appendChild(card);
  }
  list.querySelectorAll("[data-ack]").forEach((b) =>
    b.addEventListener("click", () => ackAlert(b.getAttribute("data-ack")))
  );
  list.querySelectorAll("[data-ask]").forEach((b) =>
    b.addEventListener("click", () => {
      $("#chat-text").value = `תסביר לי על ההתראה: ${b.getAttribute("data-ask")}`;
      sendMessage();
    })
  );
}

async function ackAlert(id) {
  try {
    await api(`/api/alerts/${id}/ack`, { method: "POST" });
    loadAlerts();
    loadAccounts();
  } catch {}
}

$("#refresh-btn").addEventListener("click", async () => {
  const btn = $("#refresh-btn");
  btn.disabled = true;
  btn.textContent = "סורק…";
  try {
    const body = state.account ? { account: state.account } : {};
    await api("/api/alerts/refresh", { method: "POST", body: JSON.stringify(body) });
    await loadAlerts();
    await loadAccounts();
  } catch {} finally {
    btn.disabled = false;
    btn.textContent = "↻ סריקה";
  }
});

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------
const messagesEl = $("#messages");

function clearWelcome() {
  const w = messagesEl.querySelector(".welcome");
  if (w) w.remove();
}

function addMessage(role, text) {
  clearWelcome();
  const msg = document.createElement("div");
  msg.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = role === "assistant" ? mdLite(text) : esc(text);
  msg.appendChild(bubble);
  messagesEl.appendChild(msg);
  scrollDown();
  return bubble;
}

function addToolChip(name) {
  clearWelcome();
  const labels = {
    list_accounts: "טוען רשימת חשבונות",
    get_account_overview: "בודק את מצב החשבון",
    get_campaigns: "שולף קמפיינים",
    get_performance: "מושך נתוני ביצועים",
    compare_periods: "משווה תקופות",
    get_active_alerts: "קורא התראות",
  };
  const chip = document.createElement("div");
  chip.className = "tool-chip";
  chip.innerHTML = `<span class="dot"></span> ${esc(labels[name] || name)}…`;
  messagesEl.appendChild(chip);
  scrollDown();
  return chip;
}

function scrollDown() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

async function sendMessage() {
  const text = $("#chat-text").value.trim();
  if (!text || state.streaming) return;
  $("#chat-text").value = "";
  autoGrow();
  addMessage("user", text);
  state.streaming = true;
  $("#send-btn").disabled = true;

  let bubble = null;
  let answer = "";
  const typing = document.createElement("div");
  typing.className = "typing";
  typing.textContent = "חושב…";
  messagesEl.appendChild(typing);
  scrollDown();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, account: state.account || null, history: state.history }),
    });
    if (res.status === 401) { showLogin(); return; }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop();
      for (const chunk of chunks) {
        const line = chunk.trim();
        if (!line.startsWith("data:")) continue;
        const ev = JSON.parse(line.slice(5).trim());
        if (ev.type === "tool") {
          addToolChip(ev.name);
        } else if (ev.type === "text") {
          if (typing.parentNode) typing.remove();
          if (!bubble) bubble = addMessage("assistant", "");
          answer += ev.text;
          bubble.innerHTML = mdLite(answer);
          scrollDown();
        } else if (ev.type === "error") {
          if (typing.parentNode) typing.remove();
          addMessage("assistant", "⚠️ " + ev.message);
        }
      }
    }
  } catch (e) {
    addMessage("assistant", "⚠️ שגיאת רשת בזמן השיחה");
  } finally {
    if (typing.parentNode) typing.remove();
    state.streaming = false;
    $("#send-btn").disabled = false;
    if (answer) {
      state.history.push({ role: "user", content: text });
      state.history.push({ role: "assistant", content: answer });
      state.history = state.history.slice(-12);
    }
    loadAlerts();
  }
}

$("#chat-form").addEventListener("submit", (e) => { e.preventDefault(); sendMessage(); });

const ta = $("#chat-text");
function autoGrow() { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 160) + "px"; }
ta.addEventListener("input", autoGrow);
ta.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
});

document.querySelectorAll(".suggestion").forEach((b) =>
  b.addEventListener("click", () => { $("#chat-text").value = b.textContent; sendMessage(); })
);

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function mdLite(s) {
  let t = esc(s);
  t = t.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  t = t.replace(/^## (.+)$/gm, "<h3>$1</h3>");
  return t;
}

// ---------------------------------------------------------------------------
checkAuth();
