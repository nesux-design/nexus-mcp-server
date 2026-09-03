import { CONNECTORS } from "../../config/connectors.js";
import { createAuthorizationCode } from "./oauth-code-store.js";
import { loadTokens } from "../oauth/store.js";

const encoder = new TextEncoder();
const HANDOFF_TTL_SECONDS = 300;

function securityHeaders() {
  return { "cache-control": "no-store", "pragma": "no-cache", "x-content-type-options": "nosniff", "referrer-policy": "no-referrer" };
}
function errorResponse(error, description, status = 400) {
  return Response.json({ error, ...(description ? { error_description: description } : {}) }, { status, headers: { ...securityHeaders(), "content-type": "application/json" } });
}
async function hmacHex(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
async function resolveTrustedNexusUser(request, env) {
  const userId = request.headers.get("x-nexus-user-id");
  const signature = request.headers.get("x-nexus-signature");
  const exp = request.headers.get("x-nexus-user-exp");
  const secret = env.NEXUS_INTERNAL_AUTH_SECRET;
  if (!userId || !signature || !exp || !secret) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(userId) || !/^[1-9][0-9]{9,12}$/.test(exp)) return null;
  const expiry = Number(exp);
  const now = Math.floor(Date.now() / 1000);
  if (expiry < now || expiry > now + HANDOFF_TTL_SECONDS) return null;
  const expected = await hmacHex(secret, `${userId}.${exp}`);
  return safeEqual(signature.toLowerCase(), expected) ? userId : null;
}
function validResource(request, resource) {
  if (!resource) return false;
  try {
    const expectedOrigin = new URL(request.url).origin;
    const parsed = new URL(resource);
    if (parsed.origin !== expectedOrigin) return false;
    const match = parsed.pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
    return Boolean(match && CONNECTORS[match[1]]?.mcp);
  } catch { return false; }
}
function connectorForResource(resource) { return new URL(resource).pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/)?.[1] || null; }
function validateScope(scope, provider) {
  const requested = String(scope || "mcp").split(/\s+/).filter(Boolean);
  const allowed = new Set(["mcp", ...(CONNECTORS[provider]?.scopes || [])]);
  return requested.length > 0 && requested.every((value) => allowed.has(value)) ? requested : null;
}
async function loadClientMetadata(clientId) {
  let url;
  try { url = new URL(clientId); } catch { return null; }
  if (url.protocol !== "https:") return null;
  const response = await fetch(url.toString(), { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  const metadata = await response.json();
  if (!metadata || metadata.client_id !== clientId || !Array.isArray(metadata.redirect_uris)) return null;
  return metadata;
}
function redirectAllowed(metadata, redirectUri) { return Boolean(redirectUri && metadata?.redirect_uris?.some((candidate) => candidate === redirectUri)); }
function localClient(clientId, env, redirectUri) {
  const configured = env.MCP_TRUSTED_CLIENT_ID;
  const configuredRedirect = env.MCP_TRUSTED_CLIENT_REDIRECT_URI;
  if (!configured || clientId !== configured || !configuredRedirect || redirectUri !== configuredRedirect) return null;
  return { client_id: configured, redirect_uris: [configuredRedirect] };
}
function providerStartUrl(request, provider, mcpAuth) {
  const target = new URL(`/oauth/${provider}`, request.url);
  if (!mcpAuth) return target;
  target.searchParams.set("mcp_client_id", mcpAuth.clientId);
  target.searchParams.set("mcp_redirect_uri", mcpAuth.redirectUri);
  target.searchParams.set("mcp_resource", mcpAuth.resource);
  target.searchParams.set("mcp_scope", mcpAuth.scope);
  target.searchParams.set("mcp_code_challenge", mcpAuth.codeChallenge);
  target.searchParams.set("mcp_code_challenge_method", "S256");
  if (mcpAuth.state) target.searchParams.set("mcp_state", mcpAuth.state);
  return target;
}

export async function handleMcpAuthorize(request, env) {
  if (request.method !== "GET") return errorResponse("invalid_request", "GET is required", 405);
  const url = new URL(request.url);
  const responseType = url.searchParams.get("response_type");
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state");
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod = url.searchParams.get("code_challenge_method");
  const resource = url.searchParams.get("resource");
  const scope = url.searchParams.get("scope") || "mcp";
  if (responseType !== "code") return errorResponse("unsupported_response_type", "Only authorization code flow is supported");
  if (!clientId || !redirectUri || !codeChallenge || codeChallengeMethod !== "S256") return errorResponse("invalid_request", "client_id, redirect_uri, code_challenge and S256 code_challenge_method are required");
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge)) return errorResponse("invalid_request", "Invalid PKCE code_challenge");
  if (!validResource(request, resource)) return errorResponse("invalid_target", "resource must be a registered NEXUS MCP resource");
  let metadata = localClient(clientId, env, redirectUri);
  if (!metadata) { try { metadata = await loadClientMetadata(clientId); } catch { metadata = null; } }
  if (!metadata || !redirectAllowed(metadata, redirectUri)) return errorResponse("invalid_request", "client_id or redirect_uri is not registered");
  const provider = connectorForResource(resource);
  const requestedScopes = validateScope(scope, provider);
  if (!requestedScopes) return errorResponse("invalid_scope", "Requested scope is not supported for this resource");
  const userId = await resolveTrustedNexusUser(request, env);
  if (!userId) return errorResponse("login_required", "A trusted authenticated NEXUS user handoff is required", 401);
  if (!env.OAUTH_CODES) return errorResponse("server_error", "OAuth durable storage is not configured", 503);

  const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
  const providerToken = env.TOKENS_KV ? await loadTokens(env.TOKENS_KV, provider, userId, encryptionSecret) : null;
  if (!providerToken?.access_token && CONNECTORS[provider]?.auth === "oauth2") {
    const providerStart = providerStartUrl(request, provider, {
      clientId,
      redirectUri,
      resource,
      scope: requestedScopes.join(" "),
      codeChallenge,
      codeChallengeMethod: "S256",
      state
    });
    return Response.redirect(providerStart.toString(), 302);
  }

  const issuer = new URL("/oauth", request.url).toString().replace(/\/$/, "");
  let code;
  try {
    code = await createAuthorizationCode(env, { clientId, redirectUri, resource, scope: requestedScopes.join(" "), codeChallenge, codeChallengeMethod: "S256", userId, issuer, provider });
  } catch (error) {
    console.error("OAuth authorization code storage failed", { error: error instanceof Error ? error.message : String(error) });
    return errorResponse("server_error", "Unable to create authorization code", 503);
  }
  const callback = new URL(redirectUri);
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);
  callback.searchParams.set("iss", issuer);
  return Response.redirect(callback.toString(), 302);
}
