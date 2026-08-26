function authOk(request, env) {
  if (!env.SYNC_TOKEN) return true;
  const a = request.headers.get("Authorization") || "";
  const t = a.startsWith("Bearer ") ? a.slice(7) : a;
  return t === env.SYNC_TOKEN;
}
function json(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
}
export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,PUT,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" } });
}
export async function onRequestGet({ request, env, params }) {
  if (!authOk(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.IELTS_DB) return json({ error: "IELTS_DB binding missing" }, 500);
  const value = await env.IELTS_DB.get(params.key);
  return json({ key: params.key, value: value });
}
export async function onRequestPut({ request, env, params }) {
  if (!authOk(request, env)) return json({ error: "Unauthorized" }, 401);
  if (!env.IELTS_DB) return json({ error: "IELTS_DB binding missing" }, 500);
  const body = await request.text();
  if (body.length > 20 * 1024 * 1024) return json({ error: "Value too large" }, 413);
  await env.IELTS_DB.put(params.key, body);
  return json({ ok: true });
}
