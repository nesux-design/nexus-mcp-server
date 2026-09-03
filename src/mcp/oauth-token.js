import { consumeAuthorizationCode, issueAccessToken } from "./oauth-code-store.js";

const encoder = new TextEncoder();

function headers() {
  return { "cache-control": "no-store", "pragma": "no-cache", "content-type": "application/json", "x-content-type-options": "nosniff" };
}
function jsonError(error, description, status = 400) {
  return Response.json({ error, ...(description ? { error_description: description } : {}) }, { status, headers: headers() });
}
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function pkceS256(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64Url(new Uint8Array(digest));
}

export async function handleMcpToken(request, env) {
  if (request.method !== "POST") return jsonError("invalid_request", "POST is required", 405);
  let form;
  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/x-www-form-urlencoded")) return jsonError("invalid_request", "Content-Type must be application/x-www-form-urlencoded");
    form = await request.formData();
  } catch {
    return jsonError("invalid_request", "Invalid form body");
  }
  const grantType = form.get("grant_type");
  const code = form.get("code");
  const clientId = form.get("client_id");
  const redirectUri = form.get("redirect_uri");
  const verifier = form.get("code_verifier");
  const resource = form.get("resource");
  if (grantType !== "authorization_code") return jsonError("unsupported_grant_type", "Only authorization_code is supported");
  if (typeof code !== "string" || typeof clientId !== "string" || typeof verifier !== "string") return jsonError("invalid_request", "code, client_id, and code_verifier are required");
  if (typeof redirectUri !== "string" || !redirectUri) return jsonError("invalid_request", "redirect_uri is required");
  if (typeof resource !== "string" || !resource) return jsonError("invalid_request", "resource is required");
  if (verifier.length < 43 || verifier.length > 128 || !/^[A-Za-z0-9._~-]+$/.test(verifier)) return jsonError("invalid_request", "Invalid code_verifier");
  if (!env.OAUTH_CODES) return jsonError("temporarily_unavailable", "OAuth durable storage is not configured", 503);
  const record = await consumeAuthorizationCode(env, code);
  if (!record) return jsonError("invalid_grant", "Authorization code is invalid or expired");
  if (!timingSafeEqual(record.clientId || "", clientId)) return jsonError("invalid_grant", "Authorization code client binding mismatch");
  if (!timingSafeEqual(record.redirectUri || "", redirectUri)) return jsonError("invalid_grant", "redirect_uri does not match the authorization request");
  if (!timingSafeEqual(record.resource || "", resource)) return jsonError("invalid_grant", "resource does not match the authorization request");
  if (record.codeChallengeMethod !== "S256") return jsonError("invalid_grant", "Unsupported PKCE method");
  const expectedChallenge = await pkceS256(verifier);
  if (!timingSafeEqual(expectedChallenge, record.codeChallenge || "")) return jsonError("invalid_grant", "PKCE verification failed");
  if (!record.userId) return jsonError("invalid_grant", "Authorization code has no authenticated resource owner");
  const issued = await issueAccessToken(env, { clientId: record.clientId, userId: record.userId, resource: record.resource, scope: record.scope || "", issuer: record.issuer });
  return Response.json({ access_token: issued.token, token_type: "Bearer", expires_in: issued.expiresIn, scope: record.scope || "" }, { status: 200, headers: headers() });
}
