/**
 * Transparent proxy to a user-registered custom remote MCP URL.
 * Does NOT inject fake OAuth — forwards upstream WWW-Authenticate so the
 * client can complete the real provider consent (Claude/Grok style).
 */

import { getCustomConnector, validateMcpUrl } from "./custom-connectors.js";
import { loadTokens } from "../oauth/store.js";

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length"
]);

function filterRequestHeaders(request) {
  const headers = new Headers();
  for (const [k, v] of request.headers) {
    const key = k.toLowerCase();
    if (HOP.has(key)) continue;
    // Strip NEXUS gateway identity — upstream should not see these
    if (
      key === "x-nexus-user-id" ||
      key === "x-nexus-signature" ||
      key === "cookie"
    ) {
      continue;
    }
    // Pass Authorization / Accept / Content-Type through so client can
    // send Bearer after completing upstream OAuth
    headers.set(k, v);
  }
  if (!headers.has("accept")) {
    headers.set("accept", "application/json, text/event-stream");
  }
  return headers;
}

function filterResponseHeaders(source) {
  const headers = new Headers();
  for (const [k, v] of source) {
    const key = k.toLowerCase();
    if (HOP.has(key)) continue;
    // Critical: keep WWW-Authenticate for real OAuth discovery
    headers.set(k, v);
  }
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  headers.set("x-nexus-custom-mcp", "1");
  return headers;
}

export async function proxyCustomMcp(request, env, userId, connectorId) {
  const connector = await getCustomConnector(env, userId, connectorId);
  if (!connector) {
    return Response.json(
      { error: "Custom MCP connector not found", id: connectorId },
      { status: 404, headers: { "cache-control": "no-store" } }
    );
  }

  const checked = validateMcpUrl(connector.url);
  if (!checked.ok) {
    return Response.json({ error: checked.error }, { status: 400 });
  }

  const target = checked.url;
  const headers = filterRequestHeaders(request);
  if (!headers.has("authorization")) {
    const secret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
    const token = await loadTokens(env, `custom:${connectorId}`, userId, secret).catch(() => null);
    if (token?.access_token) {
      headers.set("authorization", `${token.token_type || "Bearer"} ${token.access_token}`);
    }
  }
  const method = request.method;
  const body = ["GET", "HEAD"].includes(method) ? undefined : await request.arrayBuffer();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: "manual"
    });

    // Pass through status + body + auth challenge headers unchanged
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: filterResponseHeaders(upstream.headers)
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return Response.json({ error: "Custom MCP upstream timed out" }, { status: 504 });
    }
    return Response.json(
      { error: "Custom MCP upstream failed", detail: String(err?.message || err) },
      { status: 502 }
    );
  } finally {
    clearTimeout(timer);
  }
}
