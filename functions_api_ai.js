// POST /api/ai — server-side Gemini proxy (API kalit SERVERDA, xavfsiz)
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-3-flash', 'gemini-2.5-flash'];

function authOk(request, env) {
  if (!env.SYNC_TOKEN) return true;
  const a = request.headers.get('Authorization') || '';
  const token = a.startsWith('Bearer ') ? a.slice(7) : a;
  return token === env.SYNC_TOKEN;
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
}
export async function onRequestOptions() {
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
}

export async function onRequestPost({ request, env }) {
  if (!authOk(request, env)) return json({ error: 'Unauthorized' }, 401);
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: 'GEMINI_API_KEY env o\'rnatilmagan (Pages → Settings → Environment variables)' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const { prompt, sys = '', history = [] } = body || {};
  if (!prompt) return json({ error: 'prompt yo\'q' }, 400);

  const contents = [];
  for (const m of (history || [])) contents.push({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content }] });
  contents.push({ role: 'user', parts: [{ text: prompt }] });

  let lastError = '';
  for (const model of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents, systemInstruction: sys ? { parts: [{ text: sys }] } : undefined })
      });
      if (r.ok) {
        const d = await r.json();
        const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || null;
        if (text) return json({ text, model });
        lastError = 'Bo\'sh javob';
      } else {
        const e = await r.json().catch(() => ({}));
        lastError = e?.error?.message || ('HTTP ' + r.status);
        if (String(lastError).toLowerCase().includes('api key')) return json({ error: lastError }, 500);
      }
    } catch (err) { lastError = err.message; }
  }
  return json({ error: lastError || 'AI xatosi' }, 502);
}