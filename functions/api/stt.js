const MODELS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-2.5-flash"];
function authOk(r, e) { if (!e.SYNC_TOKEN) return true; const a = r.headers.get("Authorization") || ""; const t = a.startsWith("Bearer ") ? a.slice(7) : a; return t === e.SYNC_TOKEN; }
function json(d, s) { return new Response(JSON.stringify(d), { status: s || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }
export async function onRequestOptions() { return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization" } }); }
export async function onRequestPost({ request, env }) {
  if (!authOk(request, env)) return json({ error: "Unauthorized" }, 401);
  const key = env.GEMINI_API_KEY;
  if (!key) return json({ error: "GEMINI_API_KEY not set" }, 500);
  var b;
  try { b = await request.json(); } catch (e) { return json({ error: "Bad JSON" }, 400); }
  if (!b.audio) return json({ error: "audio missing" }, 400);
  const mime = b.mime || "audio/webm";
  let last = "";
  for (const m of MODELS) {
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + m + ":generateContent?key=" + key, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: b.audio } }, { text: "Transcribe this speech exactly as spoken. Output ONLY the transcript text." }] }] }) });
      if (r.ok) {
        const d = await r.json();
        const t = d && d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts && d.candidates[0].content.parts[0] ? d.candidates[0].content.parts[0].text : null;
        if (t) return json({ text: t, model: m });
        last = "empty transcript";
      } else {
        const e2 = await r.json().catch(function () { return {}; });
        last = (e2.error && e2.error.message) || ("HTTP " + r.status);
      }
    } catch (e) { last = e.message; }
  }
  return json({ error: last || "transcript error" }, 502);
}
