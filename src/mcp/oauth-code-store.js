const encoder = new TextEncoder();
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

function requireDo(namespace) {
  if (!namespace || typeof namespace.idFromName !== "function") {
    throw new Error("OAUTH_CODES Durable Object binding is required");
  }
}

function oauthCodeStub(namespace) {
  requireDo(namespace);
  return namespace.get(namespace.idFromName("global"));
}

async function doJson(stub, payload) {
  const response = await stub.fetch("https://oauth-code-store.internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`OAuth code store returned ${response.status}`);
  return response.json();
}

export async function createAuthorizationCode(env, record) {
  const result = await doJson(oauthCodeStub(env.OAUTH_CODES), { op: "create", record });
  if (typeof result?.code !== "string") throw new Error("OAuth code store did not return a code");
  return result.code;
}

export async function consumeAuthorizationCode(env, code) {
  const result = await doJson(oauthCodeStub(env.OAUTH_CODES), { op: "consume", code });
  return result?.record || null;
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
