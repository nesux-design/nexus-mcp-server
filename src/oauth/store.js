const encoder = new TextEncoder();
const decoder = new TextDecoder();
const PROVIDER_RECORD_TTL_SECONDS = 31_536_000;

function requireUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) throw new Error("Explicit NEXUS userId is required for token storage");
  return userId.trim();
}

export function tokenKey(provider, userId) {
  if (typeof provider !== "string" || !provider.trim()) throw new Error("OAuth provider is required");
  return `oauth:${provider}:${requireUserId(userId)}`;
}

function b64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function unb64(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
async function cryptoKey(secret) {
  if (!secret) throw new Error("NEXUS_TOKEN_ENCRYPTION_SECRET is required");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encrypt(record, secret) {
  const key = await cryptoKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(JSON.stringify(record)));
  return JSON.stringify({ v: 1, iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext)) });
}
async function decrypt(value, secret) {
  const envelope = JSON.parse(value);
  if (envelope?.v !== 1 || !envelope.iv || !envelope.ciphertext) return null;
  const key = await cryptoKey(secret);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(envelope.iv) }, key, unb64(envelope.ciphertext));
  return JSON.parse(decoder.decode(plaintext));
}

async function doJson(env, key, payload) {
  if (!env?.OAUTH_CODES || typeof env.OAUTH_CODES.idFromName !== "function") throw new Error("OAUTH_CODES Durable Object binding is required");
  const stub = env.OAUTH_CODES.get(env.OAUTH_CODES.idFromName(key));
  const response = await stub.fetch("https://oauth-store.internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`OAuth durable store returned ${response.status}`);
  return response.json();
}

export async function saveTokens(env, provider, tokens, userId, encryptionSecret) {
  const key = tokenKey(provider, userId);
  const expiresAt = tokens.expires_at || (tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null);
  const record = { ...tokens, expires_at: expiresAt, updatedAt: Date.now() };
  if (env?.OAUTH_CODES) {
    const encrypted = await encrypt(record, encryptionSecret);
    const result = await doJson(env, `provider:${key}`, {
      op: "put", kind: "provider_token", value: key, record: { encrypted }, ttl: PROVIDER_RECORD_TTL_SECONDS
    });
    if (!result?.ok) throw new Error("OAuth durable store did not persist provider credentials");
    return;
  }
  if (!env) throw new Error("OAuth token storage is not configured");
  await env.put(key, await encrypt(record, encryptionSecret));
}

export async function loadTokens(env, provider, userId, encryptionSecret) {
  const key = tokenKey(provider, userId);
  if (env?.OAUTH_CODES) {
    try {
      const result = await doJson(env, `provider:${key}`, { op: "get", kind: "provider_token", value: key });
      if (result?.record?.encrypted) return await decrypt(result.record.encrypted, encryptionSecret);
    } catch { /* legacy KV fallback below */ }
  }
  if (!env?.get) return null;
  const raw = await env.get(key);
  if (!raw) return null;
  try {
    const record = await decrypt(raw, encryptionSecret);
    if (record && env.OAUTH_CODES) {
      try { await saveTokens(env, provider, record, userId, encryptionSecret); } catch { }
    }
    return record;
  } catch { return null; }
}

export async function deleteTokens(env, provider, userId) {
  const key = tokenKey(provider, userId);
  if (env?.OAUTH_CODES) {
    try { await doJson(env, `provider:${key}`, { op: "delete", kind: "provider_token", value: key }); } catch { }
  }
  if (env?.delete) await env.delete(key);
}
