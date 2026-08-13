export function tokenKey(provider, userId = "default") {
  return `oauth:${provider}:${userId}`;
}

export async function saveTokens(kv, provider, tokens, userId = "default") {
  if (!kv) throw new Error("TOKENS_KV binding is required");
  await kv.put(tokenKey(provider, userId), JSON.stringify({ ...tokens, updatedAt: Date.now() }));
}

export async function loadTokens(kv, provider, userId = "default") {
  if (!kv) return null;
  return kv.get(tokenKey(provider, userId), "json");
}

export async function deleteTokens(kv, provider, userId = "default") {
  if (!kv) return;
  await kv.delete(tokenKey(provider, userId));
}
