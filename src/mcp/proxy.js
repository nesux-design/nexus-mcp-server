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
  headers.delete("x-nexus-mcp-access-token");
  headers.delete("x-nexus-mcp-refresh-token");
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
      authorization: `/oauth/${provider}`,
      upstreamMcp: connector.mcpUrl,
      mode: connector.auth,
      message: "No authorized MCP token is stored for this NEXUS user. Complete the provider's official MCP OAuth flow, then sync the resulting MCP token through the trusted NEXUS token endpoint."
    },
    { status: 401, headers: { "cache-control": "no-store" } }
  );
}

export async function getOAuthAccessToken(env, provider, userId) {
  const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
  const record = await loadTokens(env.TOKENS_KV, provider, userId, encryptionSecret);
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
    await saveTokens(env.TOKENS_KV, provider, merged, userId, encryptionSecret);
    return merged.access_token;
  } catch {
    return null;
  }
}

function buildUpstreamHeaders(request, connector, env, provider, accessToken) {
  const headers = filteredHeaders(request);
  if (provider === "googleDeveloperKnowledge") {
    const apiKey = env.DEVELOPERKNOWLEDGE_API_KEY;
    if (!apiKey) throw new Error("Google Developer Knowledge API key is not configured");
    headers.set("x-goog-api-key", apiKey);
  } else if (provider === "airtable") {
    const token = env.AIRTABLE_PAT;
    if (!token) throw new Error("Airtable PAT is not configured");
    headers.set("authorization", `Bearer ${token}`);
  } else if (connector.auth === "oauth2" || connector.auth === "upstream-oauth") {
    if (!accessToken) return null;
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

async function fetchUpstreamMcp(request, env, provider, body, method = request.method, contentType = null) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcp || !connector.mcpUrl) {
    return { response: Response.json({ error: "Connector is not an implemented remote MCP provider" }, { status: 404 }), userId: null };
  }

  const userId = await requireInternalUser(request, env);
  if (!userId) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } }), userId: null };
  }

  const target = projectScopedUrl(connector, env, request.url);
  const accessToken = connector.auth === "oauth2" || connector.auth === "upstream-oauth"
    ? await getOAuthAccessToken(env, provider, userId)
    : null;

  const headers = buildUpstreamHeaders(request, connector, env, provider, accessToken);
  if (!headers) return { response: oauthRequired(provider, connector), userId };
  if (contentType) headers.set("content-type", contentType);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(target.toString(), {
      method,
      headers,
      body: ["GET", "HEAD"].includes(method) ? undefined : body,
      signal: controller.signal
    });
    return {
      response: new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.headers)
      }),
      userId
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      return { response: Response.json({ error: "Upstream MCP request timed out" }, { status: 504 }), userId };
    }
    return { response: Response.json({ error: "Upstream MCP request failed" }, { status: 502 }), userId };
  } finally {
    clearTimeout(timeout);
  }
}

export async function proxyRemoteMcp(request, env, provider) {
  const body = ["GET", "HEAD"].includes(request.method) ? undefined : request.body;
  const contentType = request.headers.get("content-type");
  const { response } = await fetchUpstreamMcp(request, env, provider, body, request.method, contentType);
  return response;
}

function jsonRpcHeaders() {
  return {
    "content-type": "application/json",
    "accept": "application/json, text/event-stream"
  };
}

async function parseMcpResponse(response) {
  const text = await response.text();
  if (!text) return null;

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }

  // Remote MCP servers commonly answer JSON-RPC over SSE. Collect every data
  // event and return the last JSON-RPC message; this keeps the gateway simple
  // for the Nexus AI tool loop while preserving upstream errors.
  const messages = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const value = line.slice(5).trim();
    if (!value || value === "[DONE]") continue;
    try { messages.push(JSON.parse(value)); } catch { /* ignore non-JSON SSE data */ }
  }
  if (messages.length) return messages[messages.length - 1];

  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function mcpToolsList(request, env, provider) {
  const rpc = JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/list", params: {} });
  const { response } = await fetchUpstreamMcp(request, env, provider, rpc, "POST", "application/json");
  const payload = await parseMcpResponse(response);
  if (!response.ok) return Response.json(payload || { error: "MCP tools/list failed" }, { status: response.status });
  return Response.json(payload, { status: 200, headers: { "cache-control": "no-store" } });
}

export async function mcpToolCall(request, env, provider) {
  let body;
  try { body = await request.json(); } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 512) {
    return Response.json({ error: "Tool name is required" }, { status: 400 });
  }

  const rpc = JSON.stringify({
    jsonrpc: "2.0",
    id: body.id || crypto.randomUUID(),
    method: "tools/call",
    params: { name, arguments: body.arguments && typeof body.arguments === "object" ? body.arguments : {} }
  });

  const { response } = await fetchUpstreamMcp(request, env, provider, rpc, "POST", "application/json");
  const payload = await parseMcpResponse(response);
  if (!response.ok) return Response.json(payload || { error: "MCP tools/call failed" }, { status: response.status });
  return Response.json(payload, { status: 200, headers: { "cache-control": "no-store" } });
}
