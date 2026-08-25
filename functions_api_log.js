// POST /api/log — D1 ga yozish { table: 'activities'|'scores'|'content_index', row: {...} }
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
  if (!env.IELTS_SQL) return json({ error: 'IELTS_SQL D1 binding yo\'q (Pages → Settings → Functions → D1 bindings)' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const { table, row } = body || {};
  if (!table || !row) return json({ error: 'table va row kerak' }, 400);

  try {
    if (table === 'activities') {
      await env.IELTS_SQL.prepare('INSERT INTO activities (date, lessons_done, words_reviewed, reading_pct, listening_pct) VALUES (?,?,?,?,?)')
        .bind(row.date, row.lessons_done || 0, row.words_reviewed || 0, row.reading_pct || 0, row.listening_pct || 0).run();
    } else if (table === 'scores') {
      await env.IELTS_SQL.prepare('INSERT INTO scores (skill, band, source) VALUES (?,?,?)')
        .bind(row.skill, row.band, row.source || '').run();
    } else if (table === 'content_index') {
      await env.IELTS_SQL.prepare('INSERT OR REPLACE INTO content_index (type, ref_id, title, body, full_json) VALUES (?,?,?,?,?)')
        .bind(row.type, String(row.ref_id), row.title || '', row.body || '', row.full_json || '').run();
    } else {
      return json({ error: 'Noma\'lum table: ' + table }, 400);
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}