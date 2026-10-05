import { CONNECTORS } from "../../config/connectors.js";
import { authorizationUrl, exchangeCode } from "./oauth2.js";
import { saveTokens, loadTokens } from "./store.js";
import { requireInternalUser } from "../security/internal-auth.js";
import { createAuthorizationCode } from "../mcp/oauth-code-store.js";
import {
  createPkceVerifier,
  createPkceChallenge,
  discoverUpstreamOAuth,
  registerOAuthClient,
  buildUpstreamAuthorizationUrl,
  exchangeUpstreamCode,
} from "./upstream-mcp-oauth.js";

const PATH_TO_PROVIDER = {
  cloud: "cloudflare",
  cloudflare: "cloudflare",
  vercel: "vercel",
  netlify: "netlify",
  sentry: "sentry",
  atlassian: "atlassian",
  google: "google",
  airtable: "airtable",
  supabase: "supabase",
  github: "github",
  notion: "notion",
  linear: "linear",
  asana: "asana",
  figma: "figma",
  canva: "canva",
  slack: "slack",
  dropbox: "dropbox",
  stripe: "stripe",
  zapier: "zapier",
};

const STATE_TTL_SECONDS = 600;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function securityHeaders() {
  return { "cache-control": "no-store", "pragma": "no-cache", "x-content-type-options": "nosniff" };
}

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

async function createState(env, provider, userId, extra = {}) {
  const key = await stateKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const payload = JSON.stringify({
    v: 3,
    provider,
    userId,
    ...extra,
    exp: Math.floor(Date.now() / 1000) + STATE_TTL_SECONDS,
    nonce: crypto.randomUUID(),
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
    if (![1, 2, 3].includes(record.v) || record.provider !== provider || !record.userId || record.exp < now) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
}

function mcpAuthFromUrl(url) {
  const clientId = url.searchParams.get("mcp_client_id");
  const redirectUri = url.searchParams.get("mcp_redirect_uri");
  const resource = url.searchParams.get("mcp_resource");
  const scope = url.searchParams.get("mcp_scope") || "mcp";
  const codeChallenge = url.searchParams.get("mcp_code_challenge");
  const codeChallengeMethod = url.searchParams.get("mcp_code_challenge_method");
  const state = url.searchParams.get("mcp_state");
  if (!clientId || !redirectUri || !resource || !codeChallenge || codeChallengeMethod !== "S256") return null;
  return { clientId, redirectUri, resource, scope, codeChallenge, codeChallengeMethod, state };
}

async function finishMcpAuthorization(request, env, provider, mcpAuth, userId) {
  if (!mcpAuth || !env.OAUTH_CODES) return null;
  const issuer = new URL("/oauth", request.url).toString().replace(/\/$/, "");
  const code = await createAuthorizationCode(env, {
    clientId: mcpAuth.clientId,
    redirectUri: mcpAuth.redirectUri,
    resource: mcpAuth.resource,
    scope: mcpAuth.scope,
    codeChallenge: mcpAuth.codeChallenge,
    codeChallengeMethod: "S256",
    userId,
    issuer,
    provider,
  });
  const callback = new URL(mcpAuth.redirectUri);
  callback.searchParams.set("code", code);
  if (mcpAuth.state) callback.searchParams.set("state", mcpAuth.state);
  callback.searchParams.set("iss", issuer);
  return Response.redirect(callback.toString(), 302);
}

function resourceMetadataUrlForConnector(connector) {
  if (connector.resourceMetadataUrl) return connector.resourceMetadataUrl;
  const mcpUrl = connector.mcpUrl;
  if (!mcpUrl) return null;
  const u = new URL(mcpUrl);
  const path = u.pathname.replace(/\/+$/, "");
  return [
    path ? u.origin + "/.well-known/oauth-protected-resource" + path : null,
    u.origin + "/.well-known/oauth-protected-resource",
    u.origin + "/.well-known/oauth-authorization-server",
  ].filter(Boolean);
}

/**
 * Option B: official upstream MCP OAuth via DCR + PKCE → 302 Location
 */
export async function startUpstreamMcpOAuth(request, env, provider, userId, mcpAuth) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcpUrl) throw new Error(`No mcpUrl for ${provider}`);
  const metaUrl = resourceMetadataUrlForConnector(connector);
  if (!metaUrl) throw new Error(`No resource metadata URL for ${provider}`);

  const discovery = await discoverUpstreamOAuth(metaUrl, connector.mcpUrl);
  const redirectUri = new URL(`/oauth/${provider}/callback`, request.url).toString();
  const registration = await registerOAuthClient(
    discovery,
    redirectUri,
    `NEXUS MCP (${provider})`
  );
  const verifier = createPkceVerifier();
  const challenge = await createPkceChallenge(verifier);
  const state = await createState(env, provider, userId, {
    upstream: true,
    verifier,
    clientId: registration.clientId,
    clientSecret: registration.clientSecret,
    tokenEndpointAuthMethod: registration.tokenEndpointAuthMethod,
    discovery: {
      resource: discovery.resource,
      tokenEndpoint: discovery.tokenEndpoint,
      authorizationEndpoint: discovery.authorizationEndpoint,
    },
    redirectUri,
    mcpAuth: mcpAuth || null,
  });
  const authUrl = await buildUpstreamAuthorizationUrl({
    discovery,
    clientId: registration.clientId,
    redirectUri,
    state,
    codeChallenge: challenge,
  });
  return new Response(null, {
    status: 302,
    headers: { ...securityHeaders(), Location: authUrl.toString() },
  });
}

export async function startProviderOAuth(request, env, provider, userId, mcpAuth) {
  const connector = CONNECTORS[provider];
  if (!connector) throw new Error(`Unsupported OAuth provider: ${provider}`);

  if (connector.auth === "upstream-oauth") {
    return startUpstreamMcpOAuth(request, env, provider, userId, mcpAuth);
  }
  if (connector.auth !== "oauth2") throw new Error(`Unsupported OAuth provider: ${provider}`);
  if (!env.OAUTH_CODES) throw new Error("OAuth durable storage is not configured");

  if (connector.pkce) {
    const verifier = createPkceVerifier();
    const challenge = await createPkceChallenge(verifier);
    const state = await createState(env, provider, userId, { verifier, mcpAuth });
    return Response.redirect(authorizationUrl(request, env, provider, state, challenge).toString(), 302);
  }
  const state = await createState(env, provider, userId, { mcpAuth });
  return Response.redirect(authorizationUrl(request, env, provider, state).toString(), 302);
}

export async function handleOAuth(request, env, path) {
  const match = path.match(/^\/oauth\/([^/]+)(?:\/(start|callback))?$/);
  if (!match) return null;

  const provider = PATH_TO_PROVIDER[match[1]] || match[1];
  const connector = CONNECTORS[provider];
  if (!connector) return new Response("Unknown OAuth provider", { status: 404, headers: securityHeaders() });

  const url = new URL(request.url);
  const isCallback =
    match[2] === "callback" ||
    (!match[2] && (url.searchParams.has("code") || url.searchParams.has("error")));

  if (!isCallback) {
    const userId = await requireInternalUser(request, env);
    if (!userId) {
      return Response.json(
        { error: "Unauthorized", message: "X-Nexus-User-Id + X-Nexus-Signature required" },
        { status: 401, headers: securityHeaders() }
      );
    }
    const mcpAuth = mcpAuthFromUrl(url);
    const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;

    if (mcpAuth) {
      const existing = await loadTokens(env, provider, userId, encryptionSecret);
      if (existing?.access_token) {
        return (
          (await finishMcpAuthorization(request, env, provider, mcpAuth, userId)) ||
          Response.json({ ok: true, provider, message: "Already authorized" }, { headers: securityHeaders() })
        );
      }
    }

    if (connector.auth !== "oauth2" && connector.auth !== "upstream-oauth") {
      return new Response("Provider does not use gateway OAuth", { status: 404, headers: securityHeaders() });
    }

    try {
      return await startProviderOAuth(request, env, provider, userId, mcpAuth);
    } catch (err) {
      console.error("OAuth start failed", provider, err?.message || err);
      return Response.json(
        {
          error: "oauth_start_failed",
          provider,
          message: err?.message || String(err),
          tip: "Check provider MCP OAuth discovery / DCR / NEXUS_INTERNAL_AUTH_SECRET",
        },
        { status: 502, headers: securityHeaders() }
      );
    }
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
  if (!code || !state) {
    return new Response("Missing OAuth code or state", { status: 400, headers: securityHeaders() });
  }

  const stateRecord = await consumeState(env, state, provider);
  if (!stateRecord) {
    return new Response("Invalid or expired OAuth state", { status: 400, headers: securityHeaders() });
  }

  try {
    let tokens;
    if (stateRecord.upstream) {
      tokens = await exchangeUpstreamCode({
        discovery: stateRecord.discovery,
        clientId: stateRecord.clientId,
        clientSecret: stateRecord.clientSecret,
        tokenEndpointAuthMethod: stateRecord.tokenEndpointAuthMethod || "none",
        code,
        verifier: stateRecord.verifier,
        redirectUri: stateRecord.redirectUri,
      });
    } else {
      tokens = await exchangeCode(request, env, provider, code, stateRecord.verifier);
    }
    if (!tokens?.access_token) throw new Error("OAuth token response did not include access_token");

    const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
    await saveTokens(env, provider, tokens, stateRecord.userId, encryptionSecret);

    return (
      (await finishMcpAuthorization(request, env, provider, stateRecord.mcpAuth, stateRecord.userId)) ||
      Response.json(
        {
          ok: true,
          provider,
          userId: stateRecord.userId,
          message: "OAuth authorization completed. You can close this tab and retry MCP tools/list.",
        },
        { headers: securityHeaders() }
      )
    );
  } catch (err) {
    console.error("TOKEN EXCHANGE ERROR:", err.message);
    return Response.json(
      { error: "OAuth token exchange failed", debugMessage: err.message },
      { status: 502, headers: securityHeaders() }
    );
  }
}
