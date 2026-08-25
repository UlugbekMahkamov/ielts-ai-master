// POST /api/stt — ovozni SERVERDA transkript qilish { audio: base64, mime: 'audio/webm' }
const MODELS = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-2.5-flash'];

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
  if (!key) return json({ error: 'GEMINI_API_KEY yo\'q' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const { audio, mime = 'audio/webm' } = body || {};
  if (!audio) return json({ error: 'Audio yo\'q' }, 400);

  let lastError = '';
  for (const m of MODELS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: audio } }, { text: 'Transcribe this speech exactly as spoken. Output ONLY the transcript text.' }] }] })
      });
      if (r.ok) {
        const d = await r.json();
        const t = d?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (t) return json({ text: t, model: m });
        lastError = 'Bo\'sh transkript';
      } else {
        const e = await r.json().catch(() => ({}));
        lastError = e?.error?.message || ('HTTP ' + r.status);
      }
    } catch (err) { lastError = err.message; }
  }
  return json({ error: lastError || 'Transkript xatosi' }, 502);
}