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

function requireStore(store) {
  if (!store) throw new Error("OAuth state storage is required");
}

async function doRequest(namespace, key, action, value) {
  const id = namespace.idFromName(key);
  const stub = namespace.get(id);
  const response = await stub.fetch("https://oauth-state.internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action, key, ...(value === undefined ? {} : { value }) })
  });
  if (!response.ok) throw new Error(`OAuth state Durable Object returned ${response.status}`);
  return response.json();
}

export async function createAuthorizationCode(store, record) {
  requireStore(store);
  const code = b64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);
  const key = `authcode:${await sha256(code)}`;
  const payload = JSON.stringify({ v: 1, ...record, createdAt: now, exp: now + CODE_TTL_SECONDS });

  if (typeof store.idFromName === "function") await doRequest(store, key, "put", payload);
  else await store.put(`mcp:${key}`, payload, { expirationTtl: CODE_TTL_SECONDS });
  return code;
}

export async function consumeAuthorizationCode(store, code) {
  requireStore(store);
  if (typeof code !== "string" || code.length < 20 || code.length > 512) return null;
  const key = `authcode:${await sha256(code)}`;
  const raw = typeof store.idFromName === "function"
    ? (await doRequest(store, key, "consume")).value
    : await store.get(`mcp:${key}`);
  if (!raw) return null;
  if (typeof store.idFromName !== "function") await store.delete(`mcp:${key}`);

  let record;
  try { record = JSON.parse(raw); } catch { return null; }
  const now = Math.floor(Date.now() / 1000);
  if (record?.v !== 1 || !record.exp || record.exp <= now) return null;
  return record;
}

export async function issueAccessToken(store, record) {
  requireStore(store);
  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  const now = Math.floor(Date.now() / 1000);
  const key = `accesstoken:${await sha256(token)}`;
  const payload = JSON.stringify({ v: 1, ...record, createdAt: now, exp: now + ACCESS_TOKEN_TTL_SECONDS });

  if (typeof store.idFromName === "function") await doRequest(store, key, "put", payload);
  else await store.put(`mcp:${key}`, payload, { expirationTtl: ACCESS_TOKEN_TTL_SECONDS });
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function loadAccessToken(store, token) {
  requireStore(store);
  if (typeof token !== "string" || token.length < 20 || token.length > 512) return null;
  const key = `accesstoken:${await sha256(token)}`;
  const raw = typeof store.idFromName === "function"
    ? (await doRequest(store, key, "get")).value
    : await store.get(`mcp:${key}`);
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
