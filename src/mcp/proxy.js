import { CONNECTORS } from "../../config/connectors.js";
import { loadTokens, saveTokens } from "../oauth/store.js";
import { refreshAccessToken, isOAuthProvider } from "../oauth/oauth2.js";
import { requireInternalUser } from "../security/internal-auth.js";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host"
]);

const TOKEN_REFRESH_SKEW_MS = 60_000;

function projectScopedUrl(connector, env, requestUrl) {
  const base = new URL(connector.mcpUrl);
  if (connector.projectRefEnv && env[connector.projectRefEnv]) {
    base.searchParams.set("project_ref", env[connector.projectRefEnv]);
  }
  const requestedReadOnly = new URL(requestUrl).searchParams.get("read_only");
  if (requestedReadOnly === "true" && connector.readOnlySupported) {
    base.searchParams.set("read_only", "true");
  }
  return base;
}

function filteredHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  headers.delete("authorization");
  headers.delete("cookie");
  headers.delete("x-nexus-user-id");
  headers.delete("x-nexus-signature");
  return headers;
}

function responseHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of source) {
    if (!HOP_BY_HOP.has(name.toLowerCase())) headers.set(name, value);
  }
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "no-store");
  return headers;
}

function oauthRequired(provider, connector) {
  return Response.json(
    {
      error: "provider_authorization_required",
      provider,
      authorization: connector.mcpUrl,
      mode: connector.auth,
      message: "This provider's official MCP server owns its OAuth authorization flow. The NEXUS gateway will not substitute an unrelated API OAuth token."
    },
    { status: 401, headers: { "cache-control": "no-store" } }
  );
}

async function getOAuthAccessToken(env, provider, userId) {
  const record = await loadTokens(env.TOKENS_KV, provider, userId);
  if (!record?.access_token) return null;

  const expiresAt = Number(record.expires_at || 0);
  if (!expiresAt || expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS) {
    return record.access_token;
  }

  if (!record.refresh_token || !isOAuthProvider(provider)) {
    return record.access_token;
  }

  try {
    const refreshed = await refreshAccessToken(env, provider, record.refresh_token);
    const merged = {
      ...record,
      ...refreshed,
      refresh_token: refreshed.refresh_token || record.refresh_token
    };
    await saveTokens(env.TOKENS_KV, provider, merged, userId);
    return merged.access_token;
  } catch {
    return null;
  }
}

export async function proxyRemoteMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcp || !connector.mcpUrl) {
    return Response.json({ error: "Connector is not an implemented remote MCP provider" }, { status: 404 });
  }

  const userId = await requireInternalUser(request, env);
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });
  }

  const target = projectScopedUrl(connector, env, request.url);
  const headers = filteredHeaders(request);

  if (provider === "googleDeveloperKnowledge") {
    const apiKey = env.DEVELOPERKNOWLEDGE_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "Google Developer Knowledge API key is not configured" }, { status: 503 });
    }
    headers.set("x-goog-api-key", apiKey);
  } else if (provider === "airtable") {
    const token = env.AIRTABLE_PAT;
    if (!token) return Response.json({ error: "Airtable PAT is not configured" }, { status: 503 });
    headers.set("authorization", `Bearer ${token}`);
  } else if (provider === "supabase") {
    const token = await getOAuthAccessToken(env, provider, userId);
    if (!token) return oauthRequired(provider, connector);
    headers.set("authorization", `Bearer ${token}`);
  } else if (connector.auth === "oauth2") {
    const token = await getOAuthAccessToken(env, provider, userId);
    if (!token) return oauthRequired(provider, connector);
    headers.set("authorization", `Bearer ${token}`);
  } else if (connector.auth === "upstream-oauth") {
    return oauthRequired(provider, connector);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(target.toString(), {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      signal: controller.signal
    });
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders(response.headers)
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      return Response.json({ error: "Upstream MCP request timed out" }, { status: 504 });
    }
    return Response.json({ error: "Upstream MCP request failed" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
