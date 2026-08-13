import { CONNECTORS } from "../../config/connectors.js";
import { requireInternalUser } from "../security/internal-auth.js";

const HOP_BY_HOP = new Set([
  "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
  "te", "trailer", "transfer-encoding", "upgrade", "host"
]);

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

export async function proxyRemoteMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcpUrl) return Response.json({ error: "Connector is not a remote MCP provider" }, { status: 400 });

  const userId = await requireInternalUser(request, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: { "cache-control": "no-store" } });

  const target = projectScopedUrl(connector, env, request.url);
  const headers = filteredHeaders(request);

  if (provider === "airtable") {
    const token = env.AIRTABLE_PAT;
    if (!token) return Response.json({ error: "Airtable PAT is not configured" }, { status: 503 });
    headers.set("authorization", `Bearer ${token}`);
  }

  if (provider === "supabase") {
    const tokenRecord = await env.TOKENS_KV?.get(`oauth:supabase:${userId}`, "json");
    const token = tokenRecord?.access_token;
    if (!token) {
      return Response.json(
        { error: "Supabase authorization required", authorize: "/oauth/supabase/start" },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    }
    headers.set("authorization", `Bearer ${token}`);
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
