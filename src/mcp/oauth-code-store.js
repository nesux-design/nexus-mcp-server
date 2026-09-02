const encoder = new TextEncoder();

const CODE_TTL_SECONDS = 120;
const ACCESS_TOKEN_TTL_SECONDS = 3600;

function b64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  return b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

function requireKv(kv) {
  if (!kv) throw new Error("TOKENS_KV binding is required");
}

export async function createAuthorizationCode(kv, record) {
  requireKv(kv);
  const code = b64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);
  const key = `mcp:authcode:${await sha256(code)}`;
  await kv.put(key, JSON.stringify({ v: 1, ...record, createdAt: now, exp: now + CODE_TTL_SECONDS }), {
    expirationTtl: CODE_TTL_SECONDS
  });
  return code;
}

export async function consumeAuthorizationCode(kv, code) {
  requireKv(kv);
  if (typeof code !== "string" || code.length < 20 || code.length > 512) return null;
  const key = `mcp:authcode:${await sha256(code)}`;
  const raw = await kv.get(key);
  if (!raw) return null;

  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (record?.v !== 1 || !record.exp || record.exp <= now) {
    await kv.delete(key);
    return null;
  }

  // KV does not provide compare-and-delete. This delete makes normal replay
  // attempts fail, but strict race-free single-use requires a Durable Object.
  await kv.delete(key);
  return record;
}

export async function issueAccessToken(kv, record) {
  requireKv(kv);
  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);
  const key = `mcp:accesstoken:${await sha256(token)}`;
  await kv.put(key, JSON.stringify({ v: 1, ...record, createdAt: now, exp: now + ACCESS_TOKEN_TTL_SECONDS }), {
    expirationTtl: ACCESS_TOKEN_TTL_SECONDS
  });
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function loadAccessToken(kv, token) {
  requireKv(kv);
  if (typeof token !== "string" || token.length < 20 || token.length > 512) return null;
  const key = `mcp:accesstoken:${await sha256(token)}`;
  const raw = await kv.get(key);
  if (!raw) return null;
  try {
    const record = JSON.parse(raw);
    const now = Math.floor(Date.now() / 1000);
    if (record?.v !== 1 || !record.exp || record.exp <= now) return null;
    return record;
  } catch {
    return null;
  }
}
