const DISCOVERY_TIMEOUT_MS = 10_000;

function safeUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

async function getJson(url, signal) {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    redirect: "manual",
    signal
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: response.status, headers: response.headers, body };
}

function metadataCandidates(endpoint) {
  const url = new URL(endpoint);
  const base = `${url.origin}`;
  return [
    `${base}/.well-known/oauth-protected-resource${url.pathname}`,
    `${base}/.well-known/oauth-protected-resource`,
    `${base}/.well-known/oauth-authorization-server${url.pathname}`,
    `${base}/.well-known/oauth-authorization-server`
  ];
}

export async function discoverCustomMcp(endpoint) {
  const url = safeUrl(endpoint);
  if (!url) return { ok: false, error: "Only HTTPS MCP endpoints can be discovered" };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISCOVERY_TIMEOUT_MS);
  try {
    const metadata = {};
    for (const candidate of metadataCandidates(url.toString())) {
      try {
        const result = await getJson(candidate, controller.signal);
        if (result.status >= 200 && result.status < 300 && result.body && typeof result.body === "object") {
          if (candidate.includes("oauth-protected-resource")) metadata.protectedResource = result.body;
          if (candidate.includes("oauth-authorization-server")) metadata.authorizationServer = result.body;
        }
      } catch {
        // A provider may expose only one of the optional discovery documents.
      }
    }
    const protectedResource = metadata.protectedResource || null;
    const authorizationServer = metadata.authorizationServer || null;
    const scopes = Array.isArray(authorizationServer?.scopes_supported)
      ? authorizationServer.scopes_supported.filter((value) => typeof value === "string").slice(0, 100)
      : [];
    const authMode = protectedResource || authorizationServer ? "oauth" : "unknown";
    return {
      ok: true,
      endpoint: url.toString().replace(/\/$/, ""),
      authMode,
      protectedResource,
      authorizationServer,
      authorizationEndpoint: authorizationServer?.authorization_endpoint || null,
      tokenEndpoint: authorizationServer?.token_endpoint || null,
      registrationEndpoint: authorizationServer?.registration_endpoint || null,
      scopes
    };
  } catch (error) {
    if (error?.name === "AbortError") return { ok: false, error: "MCP discovery timed out" };
    return { ok: false, error: "MCP discovery failed" };
  } finally {
    clearTimeout(timer);
  }
}

export function discoveryStatus(result) {
  if (!result?.ok) return "error";
  if (result.authMode === "oauth") return "oauth_ready";
  return "unverified";
}
