/**
 * Proxy MCP JSON-RPC to a trusted external bridge (e.g. Telegram on Render).
 */

import { CONNECTORS } from "../../config/connectors.js";

export async function proxyBridgeMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector || connector.auth !== "bridge") {
    return Response.json({ error: "Not a bridge provider" }, { status: 404 });
  }

  const url =
    (connector.bridgeUrlEnv && env[connector.bridgeUrlEnv]) ||
    connector.defaultBridgeUrl;
  if (!url) {
    return Response.json(
      {
        error: "Bridge URL not configured",
        hint: `Set worker secret/var ${connector.bridgeUrlEnv || "bridge URL"}`
      },
      { status: 503, headers: { "cache-control": "no-store" } }
    );
  }

  const secret =
    (connector.bridgeSecretEnv && env[connector.bridgeSecretEnv]) ||
    env.NEXUS_TELEGRAM_BRIDGE_SECRET ||
    "";

  const headers = new Headers();
  headers.set("content-type", request.headers.get("content-type") || "application/json");
  headers.set("accept", request.headers.get("accept") || "application/json, text/event-stream");
  if (secret) {
    headers.set("X-Nexus-Bridge-Secret", secret);
  }

  const body = ["GET", "HEAD"].includes(request.method) ? undefined : await request.arrayBuffer();

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 60_000);
  try {
    const upstream = await fetch(url, {
      method: request.method,
      headers,
      body,
      signal: controller.signal
    });
    const out = new Headers();
    const ct = upstream.headers.get("content-type");
    if (ct) out.set("content-type", ct);
    out.set("cache-control", "no-store");
    out.set("x-content-type-options", "nosniff");
    out.set("x-nexus-bridge", provider);
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: out
    });
  } catch (err) {
    if (err?.name === "AbortError") {
      return Response.json({ error: "Bridge MCP timed out" }, { status: 504 });
    }
    return Response.json(
      { error: "Bridge MCP request failed", detail: String(err?.message || err) },
      { status: 502 }
    );
  } finally {
    clearTimeout(t);
  }
}
