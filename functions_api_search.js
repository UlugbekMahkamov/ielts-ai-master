// GET /api/search?q=dingo — barcha kontent (artikl/podcast/xato) bo'ylab qidiruv
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
  return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization' } });
}

export async function onRequestGet({ request, env }) {
  if (!authOk(request, env)) return json({ error: 'Unauthorized' }, 401);
  if (!env.IELTS_SQL) return json({ error: 'IELTS_SQL D1 binding yo\'q' }, 500);

  const q = (new URL(request.url).searchParams.get('q') || '').trim();
  if (q.length < 2) return json({ results: [] });
  const like = '%' + q + '%';

  const r = await env.IELTS_SQL.prepare(
    `SELECT type, ref_id, title, substr(body, 1, 200) snippet
     FROM content_index WHERE title LIKE ? OR body LIKE ?
     ORDER BY created_at DESC LIMIT 50`
  ).bind(like, like).all();

  return json({ results: r.results });
}