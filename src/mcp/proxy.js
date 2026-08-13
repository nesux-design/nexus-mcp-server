import { CONNECTORS } from "../../config/connectors.js";

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

export async function proxyRemoteMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcpUrl) return new Response("Connector is not a remote MCP provider", { status: 400 });

  const target = projectScopedUrl(connector, env, request.url);
  const headers = new Headers(request.headers);
  headers.delete("host");

  // PAT-backed MCP provider (currently Airtable).
  if (provider === "airtable") {
    const token = env.AIRTABLE_PAT;
    if (!token) return Response.json({ error: "Airtable PAT is not configured" }, { status: 503 });
    headers.set("authorization", `Bearer ${token}`);
  }

  // Supabase's hosted MCP performs its own OAuth flow. We deliberately do
  // not invent or hard-code an access token here; the OAuth implementation
  // must supply a valid bearer token before proxying authenticated requests.
  if (provider === "supabase") {
    const token = await env.TOKENS_KV?.get("supabase:access_token");
    if (!token) return Response.json({ error: "Supabase authorization required", authorize: "/oauth/supabase/start" }, { status: 401 });
    headers.set("authorization", `Bearer ${token}`);
  }

  const response = await fetch(target.toString(), {
    method: request.method,
    headers,
    body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}
