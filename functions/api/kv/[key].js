// Cloudflare Pages Function: /api/kv/:key
//
// A minimal authenticated key-value API. Mirrors the app's existing
// localStorage-based dbGet/dbSet model 1:1, so it can act as a cloud-backed
// mirror of the same 'ielts_*' keys without changing how the rest of the
// app reads/writes data.
//
// Requires, set up in the Cloudflare Pages dashboard for this project:
//   1. Settings -> Functions -> KV namespace bindings
//        Variable name: IELTS_DB   ->  bind to a KV namespace you create
//        (Storage & Databases -> KV -> Create namespace, e.g. "ielts-data")
//   2. Settings -> Environment variables (Production + Preview)
//        SYNC_TOKEN = <a long random secret you choose>
//      This same value must be entered into the app's Settings -> Cloud Sync
//      "Sync Token" field, otherwise every request is rejected with 401.
//
// Data model: each key stores one raw JSON string (whatever the app already
// keeps under localStorage['ielts_' + key]). No parsing/validation happens
// here — the app is the source of truth for the shape of the data.

function checkAuth(request, env) {
  const auth = request.headers.get('Authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return !!env.SYNC_TOKEN && token === env.SYNC_TOKEN;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestGet({ request, env, params }) {
  if (!env.IELTS_DB) return json({ error: 'KV namespace IELTS_DB is not bound. See setup comment in this file.' }, 500);
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  const key = params.key;
  if (!key) return json({ error: 'Missing key' }, 400);

  const value = await env.IELTS_DB.get(key);
  return json({ key, value }); // value is null if not found yet — that's fine
}

export async function onRequestPut({ request, env, params }) {
  if (!env.IELTS_DB) return json({ error: 'KV namespace IELTS_DB is not bound. See setup comment in this file.' }, 500);
  if (!checkAuth(request, env)) return json({ error: 'Unauthorized' }, 401);

  const key = params.key;
  if (!key) return json({ error: 'Missing key' }, 400);

  const body = await request.text();
  if (body.length > 20 * 1024 * 1024) return json({ error: 'Value too large (>20MB)' }, 413);

  await env.IELTS_DB.put(key, body);
  return json({ ok: true });
}
