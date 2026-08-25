// GET /api/stats?days=30 — grafiklar uchun agregat statistika
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

  const days = parseInt(new URL(request.url).searchParams.get('days') || '30', 10);

  const acts = await env.IELTS_SQL.prepare(
    `SELECT date, SUM(lessons_done) l, SUM(words_reviewed) w, MAX(reading_pct) r, MAX(listening_pct) li
     FROM activities WHERE date >= date('now', ?) GROUP BY date ORDER BY date`
  ).bind(`-${days} days`).all();

  const scores = await env.IELTS_SQL.prepare(
    'SELECT skill, band, source, created_at FROM scores ORDER BY id DESC LIMIT 200'
  ).all();

  const averages = await env.IELTS_SQL.prepare(
    'SELECT skill, ROUND(AVG(band),2) avg_band, COUNT(*) n FROM scores GROUP BY skill'
  ).all();

  return json({ activities: acts.results, scores: scores.results, averages: averages.results });
}