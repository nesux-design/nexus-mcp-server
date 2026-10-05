import { discoverCustomMcp, discoveryStatus } from "./custom-discovery.js";

/**
 * User-defined custom remote MCP connectors (Claude / Grok style).
 * Store: TOKENS_KV key custom-mcp-list:{userId}
 * Creds: TOKENS_KV key custom-mcp-cred:{userId}:{connectorId}
 */

const LIST_PREFIX = "custom-mcp-list:";
const CRED_PREFIX = "custom-mcp-cred:";
const MAX_PER_USER = 25;

async function saveCustomCreds(env, userId, connectorId, creds) {
  if (!env?.TOKENS_KV || !creds) return;
  await env.TOKENS_KV.put(`${CRED_PREFIX}${userId}:${connectorId}`, JSON.stringify({ ...creds, updatedAt: Date.now() }));
}

export async function loadCustomCreds(env, userId, connectorId) {
  if (!env?.TOKENS_KV) return null;
  const raw = await env.TOKENS_KV.get(`${CRED_PREFIX}${userId}:${connectorId}`);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export async function deleteCustomCreds(env, userId, connectorId) {
  if (!env?.TOKENS_KV) return;
  await env.TOKENS_KV.delete(`${CRED_PREFIX}${userId}:${connectorId}`);
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function listKey(userId) {
  return `${LIST_PREFIX}${userId}`;
}

function slugify(name) {
  return String(name || "mcp")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "mcp";
}

export function connectorInitial(name) {
  const value = String(name || "MCP").trim();
  return (Array.from(value)[0] || "M").toUpperCase();
}

export function connectorLogo(url, explicitLogo) {
  if (explicitLogo) {
    try {
      const logo = new URL(String(explicitLogo));
      if (logo.protocol === "https:") {
        return { logoUrl: logo.toString().slice(0, 2048), logoSource: "custom" };
      }
    } catch {
      // Fall through
    }
  }
  try {
    const u = new URL(url);
    return { logoUrl: `https://www.google.com/s2/favicons?domain=${u.hostname}&sz=64`, logoSource: "favicon" };
  } catch {
    return { logoUrl: null, logoSource: null };
  }
}

function publicConnector(c) {
  const identity = connectorLogo(c.url, c.logoUrl);
  return {
    id: c.id,
    name: c.name,
    url: c.url,
    logoUrl: identity.logoUrl,
    logoSource: c.logoSource || identity.logoSource,
    initial: c.initial || connectorInitial(c.name),
    authMode: c.authMode || "unknown",
    discoveryStatus: c.discoveryStatus || "unverified",
    authorizationEndpoint: c.authorizationEndpoint || null,
    tokenEndpoint: c.tokenEndpoint || null,
    registrationEndpoint: c.registrationEndpoint || null,
    scopes: Array.isArray(c.scopes) ? c.scopes : [],
    createdAt: c.createdAt,
    hasCredentials: Boolean(c.hasCredentials),
    oauthStartPath: c.authMode === "oauth" ? `/oauth/custom/${c.id}/start` : null,
    mcpPath: `/mcp/custom/${c.id}`,
  };
}

function validateMcpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "https:") return { ok: false, error: "Only HTTPS MCP URLs are allowed" };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1") {
    return { ok: false, error: "Localhost MCP endpoints are blocked" };
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(host)) {
    return { ok: false, error: "Private network MCP endpoints are blocked" };
  }
  if (u.username || u.password) return { ok: false, error: "URL must not contain credentials" };
  return { ok: true, url: u.toString().replace(/\/$/, "") };
}

async function readList(env, userId) {
  if (!env?.TOKENS_KV) return [];
  const raw = await env.TOKENS_KV.get(listKey(userId));
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function writeList(env, userId, list) {
  if (!env?.TOKENS_KV) return;
  await env.TOKENS_KV.put(listKey(userId), JSON.stringify(list.slice(0, MAX_PER_USER)));
}

export async function getCustomConnector(env, userId, id) {
  const list = await readList(env, userId);
  return list.find((c) => c.id === id) || null;
}

function parseAuthBody(authIn) {
  if (!authIn || typeof authIn !== "object") return null;
  const t = String(authIn.type || (authIn.apiKey ? "api_key" : authIn.bearer || authIn.token ? "bearer" : "header")).toLowerCase();
  if (t === "api_key" || t === "apikey") {
    const key = String(authIn.apiKey || authIn.value || authIn.key || "").trim();
    if (!key) return null;
    return {
      type: "api_key",
      headerName: String(authIn.headerName || "Authorization").slice(0, 64),
      value: key.startsWith("Bearer ") ? key : `Bearer ${key}`,
      rawKey: key,
    };
  }
  if (t === "bearer") {
    const token = String(authIn.bearer || authIn.token || authIn.value || "").trim();
    if (!token) return null;
    return { type: "bearer", value: token.startsWith("Bearer ") ? token : `Bearer ${token}` };
  }
  if (t === "header") {
    const hn = String(authIn.headerName || authIn.name || "").trim().slice(0, 64);
    const hv = String(authIn.value || authIn.apiKey || "").trim();
    if (!hn || !hv) return null;
    return { type: "header", headerName: hn, value: hv };
  }
  return null;
}

export async function handleCustomConnectorApi(request, env, userId) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (request.method === "GET" && parts.length === 1) {
    const list = await readList(env, userId);
    return json({ connectors: list.map(publicConnector) });
  }

  if (request.method === "GET" && parts.length === 2) {
    const connector = await getCustomConnector(env, userId, parts[1]);
    if (!connector) return json({ error: "Not found" }, 404);
    return json({ connector: publicConnector(connector) });
  }

  if (request.method === "POST" && parts.length === 1) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const name = String(body?.name || "").trim().slice(0, 80) || "Custom MCP";
    const creds = parseAuthBody(body?.auth && typeof body.auth === "object" ? body.auth : null);
    const checked = validateMcpUrl(body?.url);
    if (!checked.ok) return json({ error: checked.error }, 400);
    const discovery = await discoverCustomMcp(checked.url);
    if (!discovery.ok) return json({ error: discovery.error }, 422);

    const list = await readList(env, userId);
    if (list.length >= MAX_PER_USER) {
      return json({ error: `Maximum ${MAX_PER_USER} custom MCP connectors per user` }, 400);
    }
    const existing = list.find((c) => c.url === checked.url);
    if (existing) {
      if (creds) {
        existing.hasCredentials = true;
        if (existing.authMode !== "oauth") existing.authMode = "api_key";
        await saveCustomCreds(env, userId, existing.id, creds);
        await writeList(env, userId, list);
      }
      return json({ connector: publicConnector(existing), existing: true });
    }

    const id = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
    const identity = connectorLogo(checked.url, body?.logoUrl);
    const entry = {
      id,
      name,
      url: checked.url,
      logoUrl: identity.logoUrl,
      logoSource: identity.logoSource,
      initial: connectorInitial(name),
      authMode: discovery.authMode,
      discoveryStatus: discoveryStatus(discovery),
      authorizationEndpoint: discovery.authorizationEndpoint,
      tokenEndpoint: discovery.tokenEndpoint,
      registrationEndpoint: discovery.registrationEndpoint,
      scopes: discovery.scopes,
      createdAt: Date.now(),
      hasCredentials: false,
    };
    if (creds) {
      entry.hasCredentials = true;
      if (entry.authMode !== "oauth") entry.authMode = "api_key";
      await saveCustomCreds(env, userId, id, creds);
    }
    list.push(entry);
    await writeList(env, userId, list);

    return json({
      connector: publicConnector(entry),
      message:
        entry.authMode === "oauth"
          ? "Custom MCP added. Open oauthStartPath with NEXUS auth for 302 Location (provider consent), then use mcpPath."
          : entry.hasCredentials
            ? "Custom MCP added with API credentials. Call mcpPath with NEXUS auth."
            : "Custom MCP added. If upstream needs OAuth, open oauthStartPath; if it needs an API key, POST /custom-mcp/:id/credentials.",
    });
  }

  // POST /custom-mcp/:id/credentials
  if (request.method === "POST" && parts.length === 3 && parts[2] === "credentials") {
    const connector = await getCustomConnector(env, userId, parts[1]);
    if (!connector) return json({ error: "Not found" }, 404);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const creds = parseAuthBody(body?.auth && typeof body.auth === "object" ? body.auth : body);
    if (!creds) return json({ error: "Provide auth.apiKey, auth.bearer, or auth.headerName+value" }, 400);
    await saveCustomCreds(env, userId, parts[1], creds);
    const list = await readList(env, userId);
    const idx = list.findIndex((c) => c.id === parts[1]);
    if (idx >= 0) {
      list[idx].hasCredentials = true;
      await writeList(env, userId, list);
    }
    return json({ ok: true, connectorId: parts[1], hasCredentials: true, message: "Credentials saved. Call mcpPath to use this MCP." });
  }

  if (request.method === "DELETE" && parts.length === 2) {
    const list = await readList(env, userId);
    await deleteCustomCreds(env, userId, parts[1]);
    const next = list.filter((c) => c.id !== parts[1]);
    await writeList(env, userId, next);
    return json({ ok: true, deleted: parts[1] });
  }

  return json({ error: "Method not allowed" }, 405);
}
