// ===== 달력 로그인 + 위젯 데이터 API (Cloudflare Worker) =====
// 아이디/비밀번호로 로그인. 비밀번호는 저장하지 않고, 서버 비밀값(PEPPER)을 섞은
// HMAC 해시를 KV 키로 써서 각 계정 데이터를 분리한다. (계정 DB 없음 = 무상태)
//
// 엔드포인트 (모두 Authorization: Basic base64(아이디:비번) 헤더 필요)
//   POST /register  → 계정 칸 생성 (이미 있으면 409)
//   GET  /          → 로그인/읽기. 계정 없으면 404 (= 아이디·비번 틀림)
//   POST /          → 저장. 계정 없으면 404
//
// 사전 준비:
//   wrangler kv namespace create CAL_KV   → id 를 wrangler.toml 에
//   wrangler secret put PEPPER            → 아무 긴 랜덤 문자열
//   wrangler deploy

const enc = new TextEncoder();

async function hmacHex(secret, msg) {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Basic 헤더 → {user, pass} (UTF-8, 한글 지원). 비번에 ':' 포함 가능.
function parseBasic(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Basic\s+(.+)$/i);
  if (!m) return null;
  let decoded;
  try {
    const bin = atob(m[1].trim());
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    decoded = new TextDecoder().decode(bytes);
  } catch { return null; }
  const i = decoded.indexOf(":");
  if (i < 0) return null;
  const user = decoded.slice(0, i).trim().toLowerCase();
  const pass = decoded.slice(i + 1);
  if (!user || !pass) return null;
  return { user, pass };
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Max-Age": "86400",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    if (!env.PEPPER) return json({ error: "server not configured (PEPPER 없음)" }, 500, cors);

    const cred = parseBasic(request);
    if (!cred) return json({ error: "no auth" }, 401, cors);

    const key = "u:" + (await hmacHex(env.PEPPER, cred.user + "\n" + cred.pass));
    const path = new URL(request.url).pathname;

    // 회원가입
    if (request.method === "POST" && path.endsWith("/register")) {
      const existing = await env.CAL_KV.get(key);
      if (existing !== null) return json({ error: "exists" }, 409, cors);
      await env.CAL_KV.put(key, JSON.stringify({ store: {}, updatedAt: 0 }));
      return json({ ok: true, created: true }, 200, cors);
    }

    // 로그인 / 읽기 (위젯도 이걸 사용)
    if (request.method === "GET") {
      const data = await env.CAL_KV.get(key);
      if (data === null) return json({ error: "no account" }, 404, cors);
      return new Response(data, { headers: { ...cors, "Content-Type": "application/json" } });
    }

    // 저장
    if (request.method === "POST") {
      const exists = await env.CAL_KV.get(key);
      if (exists === null) return json({ error: "no account" }, 404, cors);
      const body = await request.text();
      let parsed;
      try { parsed = JSON.parse(body); } catch { return json({ error: "bad json" }, 400, cors); }
      if (typeof parsed !== "object" || parsed === null || typeof parsed.store !== "object") {
        return json({ error: "bad shape" }, 400, cors);
      }
      await env.CAL_KV.put(key, body);
      return json({ ok: true }, 200, cors);
    }

    return json({ error: "method not allowed" }, 405, cors);
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
