import { getCustomConnector } from "./custom-connectors.js";
import { loadCustomCreds } from "./custom-connectors.js";
import { loadTokens } from "../oauth/store.js";

const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function filteredHeaders(request) {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP) headers.delete(name);
  for (const name of [
    "x-nexus-user-id",
    "x-nexus-signature",
    "cookie",
  ]) {
    headers.delete(name);
  }
  return headers;
}

export async function proxyCustomMcp(request, env, userId, connectorId) {
  const connector = await getCustomConnector(env, userId, connectorId);
  if (!connector?.url) {
    return Response.json({ error: "Custom MCP connector not found" }, { status: 404 });
  }

  const headers = filteredHeaders(request);
  if (!headers.has("authorization")) {
    const secret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
    const token = await loadTokens(env, `custom:${connectorId}`, userId, secret).catch(() => null);
    if (token?.access_token) {
      headers.set("authorization", `${token.token_type || "Bearer"} ${token.access_token}`);
    } else {
      const creds = await loadCustomCreds(env, userId, connectorId).catch(() => null);
      if (creds?.type === "bearer" && creds.value) {
        headers.set("authorization", creds.value);
      } else if (creds?.type === "api_key" && creds.value) {
        headers.set(creds.headerName || "Authorization", creds.value);
      } else if (creds?.type === "header" && creds.headerName && creds.value) {
        headers.set(creds.headerName, creds.value);
      }
    }
  }

  const method = request.method;
  const body = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  try {
    const upstream = await fetch(connector.url, { method, headers, body });
    const outHeaders = new Headers();
    for (const [k, v] of upstream.headers) {
      if (!HOP_BY_HOP.has(k.toLowerCase())) outHeaders.set(k, v);
    }
    outHeaders.set("cache-control", "no-store");
    outHeaders.set("x-content-type-options", "nosniff");
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: outHeaders,
    });
  } catch (e) {
    return Response.json(
      { error: "Upstream custom MCP request failed", message: e?.message || String(e) },
      { status: 502 }
    );
  }
}
