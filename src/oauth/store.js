export function tokenKey(provider, userId = "default") {
  return `oauth:${provider}:${userId}`;
}

export async function saveTokens(kv, provider, tokens, userId = "default") {
  if (!kv) throw new Error("TOKENS_KV binding is required");
  const expiresAt = tokens.expires_at || (tokens.expires_in ? Date.now() + Number(tokens.expires_in) * 1000 : null);
  await kv.put(
    tokenKey(provider, userId),
    JSON.stringify({
      ...tokens,
      expires_at: expiresAt,
      updatedAt: Date.now()
    })
  );
}

export async function loadTokens(kv, provider, userId = "default") {
  if (!kv) return null;
  return kv.get(tokenKey(provider, userId), "json");
}

export async function deleteTokens(kv, provider, userId = "default") {
  if (!kv) return;
  await kv.delete(tokenKey(provider, userId));
}
