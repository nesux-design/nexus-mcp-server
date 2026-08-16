const encoder = new TextEncoder();
const decoder = new TextDecoder();

function requireUserId(userId) {
  if (typeof userId !== "string" || !userId.trim()) {
    throw new Error("Explicit NEXUS userId is required for token storage");
  }
  return userId.trim();
}

export function tokenKey(provider, userId) {
  if (typeof provider !== "string" || !provider.trim()) {
    throw new Error("OAuth provider is required");
  }
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
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(record))
  );
  return JSON.stringify({ v: 1, iv: b64(iv), ciphertext: b64(new Uint8Array(ciphertext)) });
}

async function decrypt(value, secret) {
  const envelope = JSON.parse(value);
  if (envelope?.v !== 1 || !envelope.iv || !envelope.ciphertext) return null;
  const key = await cryptoKey(secret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(envelope.iv) },
    key,
    unb64(envelope.ciphertext)
  );
  return JSON.parse(decoder.decode(plaintext));
}

export async function saveTokens(kv, provider, tokens, userId, encryptionSecret) {
  if (!kv) throw new Error("TOKENS_KV binding is required");
  const key = tokenKey(provider, userId);
  const expiresAt = tokens.expires_at || (tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null);
  const record = {
    ...tokens,
    expires_at: expiresAt,
    updatedAt: Date.now()
  };
  await kv.put(key, await encrypt(record, encryptionSecret));
}

export async function loadTokens(kv, provider, userId, encryptionSecret) {
  if (!kv) return null;
  const key = tokenKey(provider, userId);
  const raw = await kv.get(key);
  if (!raw) return null;

  try {
    return await decrypt(raw, encryptionSecret);
  } catch {
    // Fail closed: never fall back to a legacy plaintext token record. A
    // credential must be encrypted and explicitly scoped to this user.
    return null;
  }
}

export async function deleteTokens(kv, provider, userId) {
  if (!kv) return;
  await kv.delete(tokenKey(provider, userId));
}
