import { getCustomConnector } from "./custom-connectors.js";
import { loadTokens, saveTokens } from "../oauth/store.js";
import { requireInternalUser } from "../security/internal-auth.js";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const STATE_TTL = 600;

function b64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function bytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}
async function key(env) {
  const secret = env.NEXUS_INTERNAL_AUTH_SECRET;
  if (!secret) throw new Error("NEXUS_INTERNAL_AUTH_SECRET is required");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function makeState(env, record) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await key(env), encoder.encode(JSON.stringify({ ...record, exp: Math.floor(Date.now() / 1000) + STATE_TTL })));
  return `${b64(iv)}.${b64(new Uint8Array(encrypted))}`;
}
async function readState(env, value, connectorId) {
  try {
    const [iv, ciphertext] = String(value || "").split(".");
    const record = JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes(iv) }, await key(env), bytes(ciphertext))));
    if (record.connectorId !== connectorId || !record.userId || Number(record.exp) < Math.floor(Date.now() / 1000)) return null;
    return record;
  } catch {
    return null;
  }
}
function headers() { return { "cache-control": "no-store", "pragma": "no-cache", "x-content-type-options": "nosniff" }; }
function json(data, status = 200) { return Response.json(data, { status, headers: { ...headers(), "content-type": "application/json" } }); }
async function register(connector, redirectUri) {
  if (!connector.registrationEndpoint) return null;
  const response = await fetch(connector.registrationEndpoint, { method: "POST", headers: { "content-type": "application/json", accept: "application/json" }, body: JSON.stringify({ client_name: "Nexus AI", redirect_uris: [redirectUri], grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], token_endpoint_auth_method: "none" } ) });
  if (!response.ok) throw new Error(`Client registration failed (${response.status})`);
  const body = await response.json();
  if (!body.client_id) throw new Error("Client registration returned no client_id");
  return { clientId: body.client_id, clientSecret: body.client_secret || null, authMethod: body.token_endpoint_auth_method || "none" };
}
async function exchange(connector, client, code, verifier, redirectUri) {
  const params = new URLSearchParams({ grant_type: "authorization_code", code, client_id: client.clientId, redirect_uri: redirectUri, code_verifier: verifier, resource: connector.url });
  const request = { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: params };
  if (client.authMethod === "client_secret_basic") request.headers.authorization = `Basic ${btoa(`${client.clientId}:${client.clientSecret || ""}`)}`;
  else if (client.clientSecret) params.set("client_secret", client.clientSecret);
  const response = await fetch(connector.tokenEndpoint, request);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error(body.error_description || body.error || `Token exchange failed (${response.status})`);
  return body;
}
export async function handleCustomOAuth(request, env, path) {
  const match = path.match(/^\/oauth\/custom\/([A-Za-z0-9_-]+)\/(start|callback)$/);
  if (!match) return null;
  const connectorId = match[1];
  const mode = match[2];
  const url = new URL(request.url);
  const internalUser = mode === "start" ? await requireInternalUser(request, env) : null;
  const connector = internalUser ? await getCustomConnector(env, internalUser, connectorId) : null;
  if (mode === "start") {
    if (!internalUser || !connector) return json({ error: "Unauthorized or connector not found" }, 401);
    if (connector.authMode !== "oauth" || !connector.authorizationEndpoint || !connector.tokenEndpoint) return json({ error: "This connector has no complete OAuth discovery metadata" }, 422);
    const verifier = b64(crypto.getRandomValues(new Uint8Array(32)));
    const challenge = b64(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))));
    const redirectUri = new URL(`/oauth/custom/${connectorId}/callback`, request.url).toString();
    const client = await register(connector, redirectUri);
    if (!client) return json({ error: "Upstream does not support dynamic client registration" }, 422);
    const state = await makeState(env, { connectorId, userId: internalUser, verifier, client, redirectUri });
    const target = new URL(connector.authorizationEndpoint);
    target.searchParams.set("response_type", "code");
    target.searchParams.set("client_id", client.clientId);
    target.searchParams.set("redirect_uri", redirectUri);
    target.searchParams.set("state", state);
    target.searchParams.set("code_challenge", challenge);
    target.searchParams.set("code_challenge_method", "S256");
    target.searchParams.set("resource", connector.url);
    if (connector.scopes?.length) target.searchParams.set("scope", connector.scopes.join(" "));
    return Response.redirect(target.toString(), 302);
  }
  const state = await readState(env, url.searchParams.get("state"), connectorId);
  if (!state) return json({ error: "Invalid or expired OAuth state" }, 400);
  if (url.searchParams.get("error")) return json({ error: url.searchParams.get("error"), description: url.searchParams.get("error_description") }, 400);
  const connectorForUser = await getCustomConnector(env, state.userId, connectorId);
  if (!connectorForUser) return json({ error: "Connector not found" }, 404);
  try {
    const tokens = await exchange(connectorForUser, state.client, url.searchParams.get("code"), state.verifier, state.redirectUri);
    const secret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
    await saveTokens(env, `custom:${connectorId}`, tokens, state.userId, secret);
    return json({ ok: true, connectorId, message: "Custom MCP authorization completed. You can return to Nexus AI." });
  } catch (error) {
    return json({ error: "OAuth token exchange failed", description: error.message }, 502);
  }
}
