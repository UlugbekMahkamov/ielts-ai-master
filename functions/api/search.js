function authOk(r, e) { if (!e.SYNC_TOKEN) return true; const a = r.headers.get("Authorization") || ""; const t = a.startsWith("Bearer ") ? a.slice(7) : a; return t === e.SYNC_TOKEN; }
function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
export async function onRequestOptions() { return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,OPTIONS", "Access-Control-Allow-Headers": "Authorization" } }); }
export async function onRequestGet({ request, env }) {
  if (!authOk(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.IELTS_SQL) return json({ error: "IELTS_SQL binding missing" }, 500);
  const q = (new URL(request.url).searchParams.get("q") || "").trim();
  if (q.length < 2) return json({ results: [] });
  const like = "%" + q + "%";
  const r = await env.IELTS_SQL.prepare("SELECT type, ref_id, title, substr(body,1,200) snippet FROM content_index WHERE title LIKE ? OR body LIKE ? ORDER BY created_at DESC LIMIT 50").bind(like, like).all();
  return json({ results: r.results });
}
