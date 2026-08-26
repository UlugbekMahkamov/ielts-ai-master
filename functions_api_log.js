function authOk(r, e) { if (!e.SYNC_TOKEN) return true; const a = r.headers.get("Authorization") || ""; const t = a.startsWith("Bearer ") ? a.slice(7) : a; return t === e.SYNC_TOKEN; }
function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
export async function onRequestOptions() { return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" } }); }
export async function onRequestPost({ request, env }) {
  if (!authOk(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.IELTS_SQL) return json({ error: "IELTS_SQL binding missing" }, 500);
  var b;
  try { b = await request.json(); } catch (e) { return json({ error: "Bad JSON" }, 400); }
  const row = b.row || {};
  if (!b.table) return json({ error: "table missing" }, 400);
  try {
    if (b.table === "activities") {
      await env.IELTS_SQL.prepare("INSERT INTO activities (date,lessons_done,words_reviewed,reading_pct,listening_pct) VALUES (?,?,?,?,?)").bind(row.date, row.lessons_done || 0, row.words_reviewed || 0, row.reading_pct || 0, row.listening_pct || 0).run();
    } else if (b.table === "scores") {
      await env.IELTS_SQL.prepare("INSERT INTO scores (skill,band,source) VALUES (?,?,?)").bind(row.skill, row.band, row.source || "").run();
    } else if (b.table === "content_index") {
      await env.IELTS_SQL.prepare("INSERT OR REPLACE INTO content_index (type,ref_id,title,body,full_json) VALUES (?,?,?,?,?)").bind(row.type, String(row.ref_id), row.title || "", row.body || "", row.full_json || "").run();
    } else { return json({ error: "bad table" }, 400); }
    return json({ ok: true });
  } catch (e) { return json({ error: e.message }, 500); }
}