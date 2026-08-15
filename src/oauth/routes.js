import { CONNECTORS } from "../../config/connectors.js";
import { authorizationUrl, exchangeCode } from "./oauth2.js";
import { saveTokens } from "./store.js";
import { requireInternalUser } from "../security/internal-auth.js";

const PATH_TO_PROVIDER = {
  cloud: "cloudflare",
  cloudflare: "cloudflare",
  vercel: "vercel",
  netlify: "netlify",
  sentry: "sentry",
  atlassian: "atlassian",
  google: "google"
};

const STATE_TTL_SECONDS = 600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlBytes(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function stateKey(env) {
  const secret = env.NEXUS_INTERNAL_AUTH_SECRET;
  if (!secret) throw new Error("NEXUS_INTERNAL_AUTH_SECRET is required for OAuth state");
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function createState(env, provider, userId) {
  const key = await stateKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({
    v: 1,
    provider,
    userId,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID()
  });
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(payload));
  return `${base64Url(iv)}.${base64Url(new Uint8Array(ciphertext))}`;
}

async function consumeState(env, state, provider) {
  if (!state) return null;
  try {
    const [ivPart, ciphertextPart] = state.split(".");
    if (!ivPart || !ciphertextPart) return null;
    const key = await stateKey(env);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64UrlBytes(ivPart) },
      key,
      base64UrlBytes(ciphertextPart)
    );
    const record = JSON.parse(decoder.decode(plaintext));
    const now = Math.floor(Date.now() / 1000);
    if (record.v !== 1 || record.provider !== provider || !record.userId || !record.exp || record.exp < now) return null;
    return record;
  } catch {
    return null;
  }
}

function securityHeaders() {
  return {
    "cache-control": "no-store",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff"
  };
}

export async function handleOAuth(request, env, path) {
  const match = path.match(/^\/oauth\/([^/]+)(?:\/(start|callback))?$/);
  if (!match) return null;

  const requestedProvider = match[1];
  const provider = PATH_TO_PROVIDER[requestedProvider] || requestedProvider;
  const connector = CONNECTORS[provider];
  if (!connector) return new Response("Unknown OAuth provider", { status: 404, headers: securityHeaders() });

  // Official upstream-MCP providers are intentionally not forced through a
  // generic provider-API OAuth exchange. Their MCP access token must be obtained
  // from the provider's own MCP authorization flow and then synced through the
  // authenticated /internal/mcp-token/<provider> endpoint.
  if (connector.auth === "upstream-oauth") {
    return Response.json(
      {
        error: "upstream_mcp_oauth_required",
        provider,
        mcpUrl: connector.mcpUrl,
        tokenSync: `/internal/mcp-token/${provider}`,
        message: "Complete the provider's official MCP OAuth flow, then sync the resulting MCP token through the trusted NEXUS token endpoint."
      },
      { status: 409, headers: securityHeaders() }
    );
  }

  if (connector.auth !== "oauth2") {
    return new Response("Provider does not use gateway OAuth", { status: 404, headers: securityHeaders() });
  }

  const url = new URL(request.url);
  const explicitAction = match[2];
  const isCallback = explicitAction === "callback" || (!explicitAction && (url.searchParams.has("code") || url.searchParams.has("error")));

  if (!isCallback) {
    const userId = await requireInternalUser(request, env);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: securityHeaders() });
    const state = await createState(env, provider, userId);
    return Response.redirect(authorizationUrl(request, env, provider, state).toString(), 302);
  }

  const error = url.searchParams.get("error");
  if (error) {
    return Response.json(
      { error, description: url.searchParams.get("error_description") },
      { status: 400, headers: securityHeaders() }
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("Missing OAuth code or state", { status: 400, headers: securityHeaders() });

  const stateRecord = await consumeState(env, state, provider);
  if (!stateRecord) return new Response("Invalid or expired OAuth state", { status: 400, headers: securityHeaders() });

  try {
    const tokens = await exchangeCode(request, env, provider, code);
    const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
    await saveTokens(env.TOKENS_KV, provider, tokens, stateRecord.userId, encryptionSecret);
    return Response.json(
      { ok: true, provider, message: "OAuth authorization completed" },
      { headers: securityHeaders() }
    );
  } catch (err) {
    console.error("TOKEN EXCHANGE ERROR:", err.message);
    return Response.json(
      { error: "OAuth token exchange failed", debugMessage: err.message },
      { status: 502, headers: securityHeaders() }
    );
  }
}
