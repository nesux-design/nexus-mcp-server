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

function requireDo(namespace) {
  if (!namespace || typeof namespace.idFromName !== "function") {
    throw new Error("OAUTH_CODES Durable Object binding is required");
  }
}

function recordStub(namespace, key) {
  requireDo(namespace);
  return namespace.get(namespace.idFromName(key));
}

async function doJson(stub, payload) {
  const response = await stub.fetch("https://oauth-store.internal", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`OAuth durable store returned ${response.status}`);
  return response.json();
}

export async function createAuthorizationCode(env, record) {
  const code = b64(crypto.getRandomValues(new Uint8Array(32)));
  const key = `code:${await sha256(code)}`;
  const result = await doJson(recordStub(env.OAUTH_CODES, key), {
    op: "put",
    kind: "authorization_code",
    value: code,
    record
  });
  if (!result?.ok) throw new Error("OAuth code store did not persist the authorization code");
  return code;
}

export async function consumeAuthorizationCode(env, code) {
  if (typeof code !== "string" || code.length < 20 || code.length > 512) return null;
  const key = `code:${await sha256(code)}`;
  const result = await doJson(recordStub(env.OAUTH_CODES, key), {
    op: "consume",
    kind: "authorization_code",
    value: code
  });
  return result?.record || null;
}

export async function issueAccessToken(env, record) {
  const token = b64(crypto.getRandomValues(new Uint8Array(32)));
  const key = `token:${await sha256(token)}`;
  const result = await doJson(recordStub(env.OAUTH_CODES, key), {
    op: "put",
    kind: "access_token",
    value: token,
    record,
    ttl: ACCESS_TOKEN_TTL_SECONDS
  });
  if (!result?.ok) throw new Error("OAuth durable store did not persist the access token");
  return { token, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
}

export async function loadAccessToken(env, token) {
  if (typeof token !== "string" || token.length < 20 || token.length > 512) return null;
  const key = `token:${await sha256(token)}`;
  const result = await doJson(recordStub(env.OAUTH_CODES, key), {
    op: "get",
    kind: "access_token",
    value: token
  });
  return result?.record || null;
}
