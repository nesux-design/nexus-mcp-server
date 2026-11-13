export { getOAuthAccessToken } from "../oauth/token-refresh.js";
import { CONNECTORS } from "../../config/connectors.js";
import { loadTokens, saveTokens } from "../oauth/store.js";
import { requireInternalUser } from "../security/internal-auth.js";
import { getOAuthAccessToken } from "../oauth/token-refresh.js";

const HOP_BY_HOP = new Set(["connection", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailer", "transfer-encoding", "upgrade", "host"]);
const TOKEN_REFRESH_SKEW_MS = 60_000;

function projectScopedUrl(connector, env, requestUrl) {
  const base = new URL(connector.mcpUrl);
  if (connector.projectRefEnv && env[connector.projectRefEnv]) base.searchParams.set("project_ref", env[connector.projectRefEnv]);
  const requestedReadOnly = new URL(requestUrl).searchParams.get("read_only");
  if (requestedReadOnly === "true" && connector.readOnlySupported) base.searchParams.set("read_only", "true");
  return base;
}

function filteredHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  for (const name of ["authorization", "cookie", "x-nexus-user-id", "x-nexus-signature", "x-nexus-mcp-access-token", "x-nexus-mcp-refresh-token"]) {
    headers.delete(name);
  }
  return headers;
}

function responseHeaders(source) {
  const headers = new Headers();
  for (const [name, value] of source) if (!HOP_BY_HOP.has(name.toLowerCase())) headers.set(name, value);
  headers.set("x-content-type-options", "nosniff");
  headers.set("cache-control", "no-store");
  return headers;
}

function oauthRequired(provider, connector) {
  return Response.json({
    error: "provider_authorization_required",
    provider,
    authorization: `/oauth/${provider}/start`,
    location_hint: `Open GET /oauth/${provider}/start with X-Nexus-User-Id + X-Nexus-Signature to receive 302 Location (official MCP consent page).`,
    upstreamMcp: connector.mcpUrl,
    mode: connector.auth,
    message: "No authorized provider token is stored for this NEXUS user. Complete OAuth via /oauth/" + provider + "/start"
  }, { status: 401, headers: { "cache-control": "no-store" } });
}

function buildUpstreamHeaders(request, connector, env, provider, accessToken) {
  const headers = filteredHeaders(request);

  if (provider === "googleDeveloperKnowledge") {
    const apiKey = env.DEVELOPERKNOWLEDGE_API_KEY;
    if (!apiKey) throw new Error("Google Developer Knowledge API key is not configured");
    headers.set("x-goog-api-key", apiKey);
    return headers;
  }

  if (connector.auth === "upstream-oauth" || connector.auth === "oauth2") {
    if (!accessToken) return null;
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function fetchUpstreamMcp(request, env, provider, body, method = request.method, contentType = null, authenticatedUserId = null) {
  const connector = CONNECTORS[provider];
  if (connector?.oauthClientPolicy === "approved-only") {
    return { response: Response.json({ error: "provider_client_approval_required", provider, message: "This MCP provider only accepts approved OAuth clients. Nexus cannot complete generic OAuth/DCR until the provider approves the Nexus client." }, { status: 501, headers: { "cache-control": "no-store" } }), userId: null };
  }
  if (!connector?.mcp || !connector.mcpUrl) {
    return { response: Response.json({ error: "Connector is not an implemented remote MCP provider" }, { status: 404 }), userId: null };
  }

  const userId = authenticatedUserId || await requireInternalUser(request, env);
  if (!userId) {
    return { response: Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } }), userId: null };
  }

  const target = projectScopedUrl(connector, env, request.url);

  const needsOauth = connector.auth === "oauth2" || connector.auth === "upstream-oauth";
  let accessToken = needsOauth ? await getOAuthAccessToken(env, provider, userId) : null;

  const headers = buildUpstreamHeaders(request, connector, env, provider, accessToken);
  if (!headers) return { response: oauthRequired(provider, connector), userId };

  if (contentType) headers.set("content-type", contentType);

  async function doFetch(hdrs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    try {
      return await fetch(target.toString(), {
        method,
        headers: hdrs,
        body: ["GET", "HEAD"].includes(method) ? undefined : body,
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  try {
    let response = await doFetch(headers);
    if (needsOauth && response.status === 401) {
      const renewed = await getOAuthAccessToken(env, provider, userId, { forceRefresh: true });
      if (renewed && renewed !== accessToken) {
        const hdrs2 = buildUpstreamHeaders(request, connector, env, provider, renewed);
        if (hdrs2) {
          if (contentType) hdrs2.set("content-type", contentType);
          response = await doFetch(hdrs2);
        }
      } else if (!renewed) {
        return { response: oauthRequired(provider, connector), userId };
      }
    }
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
  }
}

export async function proxyRemoteMcp(request, env, provider, authenticatedUserId = null) {
  const body = ["GET", "HEAD"].includes(request.method) ? null : await request.arrayBuffer();
  const contentType = request.headers.get("content-type");
  const { response } = await fetchUpstreamMcp(request, env, provider, body, request.method, contentType, authenticatedUserId);
  return response;
}

function jsonRpcHeaders() {
  return { "content-type": "application/json", "accept": "application/json, text/event-stream" };
}

async function parseMcpResponse(response) {
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }
  const messages = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const value = line.slice(5).trim();
    if (!value || value === "[DONE]") continue;
    try { messages.push(JSON.parse(value)); } catch { }
  }
  if (messages.length) return messages[messages.length - 1];
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

export async function mcpToolsList(request, env, provider) {
  const rpc = JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: "tools/list", params: {} });
  const { response } = await fetchUpstreamMcp(request, env, provider, rpc, "POST", "application/json");
  const payload = await parseMcpResponse(response);
  if (!response.ok) return Response.json(payload || { error: "MCP tools/list failed" }, { status: response.status });
  return Response.json(payload, { status: 200, headers: jsonRpcHeaders() });
}

export async function mcpToolCall(request, env, provider) {
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length > 512) return Response.json({ error: "Tool name is required" }, { status: 400 });
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
