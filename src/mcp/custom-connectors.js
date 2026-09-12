/**
 * User-defined custom remote MCP connectors (Claude / Grok style).
 * Store: TOKENS_KV key custom-mcp-list:{userId}
 */

const LIST_PREFIX = "custom-mcp-list:";
const MAX_PER_USER = 25;

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

/** Block obvious SSRF targets */
export function validateMcpUrl(raw) {
  let u;
  try {
    u = new URL(String(raw || "").trim());
  } catch {
    return { ok: false, error: "Invalid URL" };
  }
  if (u.protocol !== "https:") {
    return { ok: false, error: "Only https:// MCP URLs are allowed" };
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".localhost")
  ) {
    return { ok: false, error: "Private/localhost hosts are not allowed" };
  }
  // Basic private IPv4 ranges
  const m = host.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || (a === 192 && b === 168) || (a === 169 && b === 254)) {
      return { ok: false, error: "Private IP addresses are not allowed" };
    }
    if (a === 172 && b >= 16 && b <= 31) {
      return { ok: false, error: "Private IP addresses are not allowed" };
    }
  }
  if (u.username || u.password) {
    return { ok: false, error: "URL must not contain credentials" };
  }
  return { ok: true, url: u.toString().replace(/\/$/, "") };
}

async function readList(env, userId) {
  if (!env?.TOKENS_KV?.get) return [];
  const raw = await env.TOKENS_KV.get(listKey(userId));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeList(env, userId, list) {
  if (!env?.TOKENS_KV?.put) throw new Error("TOKENS_KV is not configured");
  await env.TOKENS_KV.put(listKey(userId), JSON.stringify(list));
}

export async function getCustomConnector(env, userId, id) {
  const list = await readList(env, userId);
  return list.find((c) => c.id === id) || null;
}

export async function handleCustomConnectorApi(request, env, userId) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);
  // /custom-mcp or /custom-mcp/:id

  if (request.method === "GET" && parts.length === 1) {
    const list = await readList(env, userId);
    return json({
      connectors: list.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        createdAt: c.createdAt,
        mcpPath: `/mcp/custom/${c.id}`
      }))
    });
  }

  if (request.method === "POST" && parts.length === 1) {
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const name = String(body?.name || "").trim().slice(0, 80) || "Custom MCP";
    const checked = validateMcpUrl(body?.url);
    if (!checked.ok) return json({ error: checked.error }, 400);

    const list = await readList(env, userId);
    if (list.length >= MAX_PER_USER) {
      return json({ error: `Maximum ${MAX_PER_USER} custom MCP connectors per user` }, 400);
    }
    // Dedupe by URL
    const existing = list.find((c) => c.url === checked.url);
    if (existing) {
      return json({
        connector: {
          id: existing.id,
          name: existing.name,
          url: existing.url,
          mcpPath: `/mcp/custom/${existing.id}`,
          createdAt: existing.createdAt
        },
        existing: true
      });
    }

    const id = `${slugify(name)}-${crypto.randomUUID().slice(0, 8)}`;
    const entry = {
      id,
      name,
      url: checked.url,
      createdAt: Date.now()
    };
    list.push(entry);
    await writeList(env, userId, list);

    return json(
      {
        connector: {
          id: entry.id,
          name: entry.name,
          url: entry.url,
          mcpPath: `/mcp/custom/${entry.id}`,
          createdAt: entry.createdAt
        },
        message:
          "Custom MCP added. Call mcpPath with NEXUS auth. If the upstream requires OAuth, it will return 401 + WWW-Authenticate (real provider consent) — same as Claude/Grok custom connectors."
      },
      201
    );
  }

  if (request.method === "DELETE" && parts.length === 2) {
    const id = parts[1];
    const list = await readList(env, userId);
    const next = list.filter((c) => c.id !== id);
    if (next.length === list.length) return json({ error: "Not found" }, 404);
    await writeList(env, userId, next);
    return json({ ok: true, deleted: id });
  }

  return json({ error: "Method not allowed" }, 405);
}
