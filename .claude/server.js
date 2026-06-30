const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const PORT = process.env.PORT || 3334;
const ROOT = path.join(__dirname, '..');

// ── ENV LOADER ──────────────────────────────────────────────────────────
;(function loadEnv() {
  try {
    const content = fs.readFileSync(path.join(ROOT, '.env'), 'utf8');
    content.split('\n').forEach(line => {
      const t = line.trim();
      if (!t || t.startsWith('#')) return;
      const eq = t.indexOf('=');
      if (eq < 1) return;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[k]) process.env[k] = v;
    });
    console.log('✓ .env loaded');
  } catch { console.log('ℹ No .env file – using environment variables'); }
})();

// ── MIME TYPES ──────────────────────────────────────────────────────────
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

// ── HTTP HELPERS ─────────────────────────────────────────────────────────
function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise(resolve => {
    let b = '';
    req.on('data', c => b += c);
    req.on('end', () => { try { resolve(JSON.parse(b || '{}')); } catch { resolve({}); } });
  });
}

// ── SUPABASE REST HELPER ─────────────────────────────────────────────────
async function sbFetch(endpoint, opts = {}) {
  const url = (process.env.SUPABASE_URL || '') + endpoint;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const res  = await fetch(url, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Supabase ${res.status}: ${txt}`);
  }
  const txt = await res.text();
  return txt ? JSON.parse(txt) : null;
}

// ── META API HELPER ───────────────────────────────────────────────────────
async function metaFetch(endpoint, params, token) {
  const qs  = new URLSearchParams({ ...params, access_token: token }).toString();
  const res = await fetch(`https://graph.facebook.com/v20.0/${endpoint}?${qs}`);
  const data = await res.json();
  if (data.error) {
    const e = data.error;
    if (e.code === 190) throw Object.assign(new Error('META_TOKEN_EXPIRED'), { code: 'TOKEN_EXPIRED' });
    if (e.code === 17)  throw Object.assign(new Error('META_RATE_LIMIT'),    { code: 'RATE_LIMIT' });
    throw new Error(e.message || 'Meta API error');
  }
  return data;
}

// ── GET META CONNECTION FOR CLIENT ────────────────────────────────────────
async function getMetaConn(client_id) {
  const rows = await sbFetch(
    `/rest/v1/meta_connections?client_id=eq.${client_id}&select=access_token,ad_account_id&limit=1`
  );
  if (!rows?.length) throw new Error('No Meta connection configured for this client');
  return rows[0];
}

// ── DATE RANGE HELPER ─────────────────────────────────────────────────────
function buildDateParams(preset, date_from, date_to) {
  const MAP = {
    today:    'today',
    last7:    'last_7d',
    last14:   'last_14d',
    thisMonth:'this_month',
    last30:   'last_30d',
  };
  if (preset && preset !== 'custom' && MAP[preset]) {
    return { date_preset: MAP[preset] };
  }
  if (date_from && date_to) {
    return { time_range: JSON.stringify({ since: date_from, until: date_to }) };
  }
  return { date_preset: 'last_7d' };
}

// ── INSIGHTS FIELDS ───────────────────────────────────────────────────────
const INSIGHT_FIELDS = [
  'spend','impressions','clicks','reach',
  'ctr','cpm','frequency',
  'actions','cost_per_action_type','purchase_roas',
].join(',');

// ── META OAUTH CONNECT ────────────────────────────────────────────────────
async function handleMetaConnect(res, body) {
  const { user_id, token } = body;
  if (!user_id || !token) return sendJson(res, 400, { error: 'user_id and token required' });

  // Exchange short-lived token for long-lived (60 days) when credentials are available
  const appId     = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  let finalToken  = token;

  if (appId && appSecret) {
    try {
      const exRes  = await fetch(
        `https://graph.facebook.com/v20.0/oauth/access_token`
        + `?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${token}`
      );
      const exData = await exRes.json();
      if (exData.access_token) finalToken = exData.access_token;
    } catch { /* keep short-lived token as fallback */ }
  }

  // Upsert into user_meta_tokens
  await sbFetch('/rest/v1/user_meta_tokens', {
    method:  'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ user_id, access_token: finalToken, updated_at: new Date().toISOString() }),
  });

  return sendJson(res, 200, { ok: true });
}

// ── META ACCOUNTS FOR USER ────────────────────────────────────────────────
async function handleMetaAccounts(res, body) {
  const { user_id, preset, date_from, date_to } = body;
  if (!user_id) return sendJson(res, 400, { error: 'user_id required' });

  // Look up the user's stored Meta token
  const rows = await sbFetch(
    `/rest/v1/user_meta_tokens?user_id=eq.${user_id}&select=access_token&limit=1`
  );
  if (!rows?.length) {
    return sendJson(res, 404, { error: 'META_NOT_CONNECTED' });
  }
  const token = rows[0].access_token;

  const dateParams = buildDateParams(preset, date_from, date_to);
  const dp         = dateParams.date_preset || 'last_7d';

  const data = await metaFetch('me/adaccounts', {
    fields: `id,name,account_status,currency,`
          + `insights.date_preset(${dp}){${INSIGHT_FIELDS}}`,
    limit: 200,
  }, token);

  return sendJson(res, 200, data);
}

// ── META API ROUTE HANDLER ────────────────────────────────────────────────
async function handleMeta(res, body, route) {
  const { client_id, campaign_id, adset_id, preset, date_from, date_to } = body;
  if (!client_id) return sendJson(res, 400, { error: 'client_id required' });

  const conn        = await getMetaConn(client_id);
  const { access_token, ad_account_id } = conn;
  const dateParams  = buildDateParams(preset, date_from, date_to);

  switch (route) {

    case 'insights': {
      const data = await metaFetch(
        `act_${ad_account_id}/insights`,
        { fields: INSIGHT_FIELDS, ...dateParams },
        access_token
      );
      return sendJson(res, 200, data);
    }

    case 'campaigns': {
      const data = await metaFetch(
        `act_${ad_account_id}/campaigns`,
        {
          fields: `id,name,status,objective,daily_budget,lifetime_budget,`
                + `insights.date_preset(${dateParams.date_preset || 'last_7d'}){${INSIGHT_FIELDS}}`,
          limit: 100,
          ...( dateParams.time_range ? dateParams : {} ),
        },
        access_token
      );
      return sendJson(res, 200, data);
    }

    case 'adsets': {
      const endpoint = campaign_id
        ? `${campaign_id}/adsets`
        : `act_${ad_account_id}/adsets`;
      const data = await metaFetch(
        endpoint,
        {
          fields: `id,name,status,daily_budget,lifetime_budget,targeting,`
                + `insights.date_preset(${dateParams.date_preset || 'last_7d'}){${INSIGHT_FIELDS}}`,
          limit: 100,
        },
        access_token
      );
      return sendJson(res, 200, data);
    }

    case 'ads': {
      const endpoint = adset_id
        ? `${adset_id}/ads`
        : campaign_id
        ? `${campaign_id}/ads`
        : `act_${ad_account_id}/ads`;

      const data = await metaFetch(
        endpoint,
        {
          fields: `id,name,status,`
                + `creative{id,name,title,body,image_url,thumbnail_url,`
                + `video_id,object_story_spec,asset_feed_spec},`
                + `insights.date_preset(${dateParams.date_preset || 'last_7d'}){${INSIGHT_FIELDS}}`,
          limit: 100,
        },
        access_token
      );
      return sendJson(res, 200, data);
    }

    case 'sync': {
      // Fetch last 7 days insights per campaign and store snapshots
      const campaigns = await metaFetch(
        `act_${ad_account_id}/campaigns`,
        { fields: `id,name,insights.date_preset(last_7d){${INSIGHT_FIELDS},date_start,date_stop}`, limit: 100 },
        access_token
      );
      let saved = 0;
      for (const camp of (campaigns.data || [])) {
        const ins = camp.insights?.data?.[0];
        if (!ins) continue;
        const actions  = ins.actions || [];
        const results  = actions.reduce((s, a) => s + parseInt(a.value || 0, 10), 0);
        const cpa      = results > 0 ? parseFloat(ins.spend) / results : null;
        const roasArr  = ins.purchase_roas || [];
        const roas     = roasArr[0] ? parseFloat(roasArr[0].value) : null;
        await sbFetch('/rest/v1/campaign_snapshots', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify({
            client_id,
            campaign_id:   camp.id,
            campaign_name: camp.name,
            date:          ins.date_start,
            spend:         parseFloat(ins.spend || 0),
            results,
            cpa,
            roas,
            ctr:           parseFloat(ins.ctr || 0),
            cpm:           parseFloat(ins.cpm || 0),
            frequency:     parseFloat(ins.frequency || 0),
            impressions:   parseInt(ins.impressions || 0, 10),
            clicks:        parseInt(ins.clicks || 0, 10),
            reach:         parseInt(ins.reach || 0, 10),
            raw_data_json: ins,
          }),
        });
        saved++;
      }
      // Update last_sync_at
      await sbFetch(
        `/rest/v1/meta_connections?client_id=eq.${client_id}`,
        { method: 'PATCH', body: JSON.stringify({ last_sync_at: new Date().toISOString() }) }
      );
      return sendJson(res, 200, { ok: true, saved });
    }

    default:
      return sendJson(res, 404, { error: `Unknown Meta route: ${route}` });
  }
}

// ── AI ROUTE HANDLER ──────────────────────────────────────────────────────
async function handleAi(res, body, route) {
  switch (route) {

    case 'analyze': {
      const { client_id, insights, campaigns } = body;
      if (!client_id) return sendJson(res, 400, { error: 'client_id required' });

      const recs = await generateRecommendations(insights, campaigns);

      // Dismiss old pending recs for this client, then insert new ones
      await sbFetch(
        `/rest/v1/ai_recommendations?client_id=eq.${client_id}&status=eq.pending`,
        { method: 'PATCH', body: JSON.stringify({ status: 'dismissed' }) }
      );
      const saved = [];
      for (const r of recs) {
        const row = await sbFetch('/rest/v1/ai_recommendations', {
          method: 'POST',
          body: JSON.stringify({ client_id, ...r, status: 'pending' }),
        });
        if (row?.[0]) saved.push(row[0]);
      }
      return sendJson(res, 200, { recommendations: saved });
    }

    default:
      return sendJson(res, 404, { error: `Unknown AI route: ${route}` });
  }
}

// ── AI: GENERATE RECOMMENDATIONS ─────────────────────────────────────────
async function generateRecommendations(insights, campaigns) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;

  const prompt = buildPrompt(insights, campaigns);

  if (anthropicKey) return callAnthropic(prompt, anthropicKey);
  if (openaiKey)    return callOpenAI(prompt, openaiKey);
  return mockRecs();
}

function buildPrompt(insights, campaigns) {
  const top = (campaigns || []).slice(0, 8).map(c => ({
    name: c.name,
    spend: c.spend,
    results: c.results,
    cpa: c.cpa,
    ctr: c.ctr,
    frequency: c.frequency,
  }));

  return `You are an expert Meta Ads campaign manager. Analyze the data below and return 3-5 actionable recommendations.

ACCOUNT INSIGHTS (last 7 days):
${JSON.stringify(insights || {}, null, 2)}

TOP CAMPAIGNS:
${JSON.stringify(top, null, 2)}

Reply with ONLY a valid JSON array (no markdown, no other text):
[
  {
    "title": "Short action title (Hebrew is fine)",
    "explanation": "2-3 sentence explanation of the issue and recommendation (Hebrew is fine)",
    "severity": "low|medium|high|critical",
    "suggested_action": "Specific actionable step",
    "confidence": <integer 0-100>,
    "related_metric": "cpa|roas|ctr|frequency|spend|results|cpm"
  }
]`;
}

async function callAnthropic(prompt, key) {
  const res  = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-opus-4-7', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  const text = data?.content?.[0]?.text || '[]';
  try { return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]'); } catch { return mockRecs(); }
}

async function callOpenAI(prompt, key) {
  const res  = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: prompt }] }),
  });
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '[]';
  try { return JSON.parse(text.match(/\[[\s\S]*\]/)?.[0] || '[]'); } catch { return mockRecs(); }
}

function mockRecs() {
  return [
    { title: 'CPA עלה השבוע', explanation: 'עלות לתוצאה עלתה ב-24%. בדוק קריאייטיבים וחלוקת תקציב.', severity: 'high',   suggested_action: 'עצור קמפיינים עם CPA גבוה מהממוצע', confidence: 85, related_metric: 'cpa' },
    { title: 'תדירות גבוהה',  explanation: 'תדירות מעל 4 — סימן לעייפות קריאייטיבית. שקול רענון.',    severity: 'medium', suggested_action: 'רענן קריאייטיבים או הרחב קהלים',      confidence: 78, related_metric: 'frequency' },
    { title: 'CTR נמוך',      explanation: 'אחוז הקלקה מתחת לממוצע ענפי. בחן זוויות מסר חדשות.',   severity: 'medium', suggested_action: 'בדוק קופי ועצב מודעה עם CTA חזק יותר', confidence: 70, related_metric: 'ctr' },
  ];
}

// ── MAIN REQUEST HANDLER ──────────────────────────────────────────────────
http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    });
    return res.end();
  }

  // API routes
  if (url.startsWith('/api/')) {
    const body = req.method === 'POST' ? await readBody(req) : {};
    try {
      if (url === '/api/meta/connect')    return await handleMetaConnect(res, body);
      if (url === '/api/meta/accounts')  return await handleMetaAccounts(res, body);
      if (url.startsWith('/api/meta/'))  return await handleMeta(res, body, url.slice(10));
      if (url.startsWith('/api/ai/'))    return await handleAi(res,   body, url.slice(8));
      if (url === '/api/health')         return sendJson(res, 200, { ok: true, ts: new Date().toISOString() });
      return sendJson(res, 404, { error: 'Unknown API route' });
    } catch (err) {
      console.error('[API error]', url, err.message);
      const code = err.code === 'TOKEN_EXPIRED' ? 401 : err.code === 'RATE_LIMIT' ? 429 : 500;
      return sendJson(res, code, { error: err.message });
    }
  }

  // Static files
  let filePath = url === '/' || url === '' ? '/agency-dashboard.html' : url;
  filePath = path.join(ROOT, filePath);
  const ext = path.extname(filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': mime[ext] || 'text/plain' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`Serving on http://localhost:${PORT}`));
