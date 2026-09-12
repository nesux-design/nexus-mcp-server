/**
 * 10 custom MCP providers transferred from nexus-a1.
 * Same JSON-RPC surface as official MCP: initialize | tools/list | tools/call
 * Auth: stored OAuth access_token (per NEXUS user) or API key / bridge.
 */

import { getOAuthAccessToken } from "./proxy.js";
import { loadTokens } from "../oauth/store.js";

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function rpcResult(id, result) {
  return json({ jsonrpc: "2.0", id: id ?? null, result });
}

function rpcError(id, code, message) {
  return json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });
}

function toolResult(obj, isError = false) {
  const text = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
  return {
    content: [{ type: "text", text }],
    isError: Boolean(isError || (obj && obj.error))
  };
}

async function needToken(env, provider, userId) {
  const token = await getOAuthAccessToken(env, provider, userId);
  if (!token) {
    return {
      error: true,
      message: `No OAuth token for ${provider}. Connect this app in nexus-a1 OAuth first, then call tools again.`
    };
  }
  return { token };
}

async function fullTokenRecord(env, provider, userId) {
  const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
  return loadTokens(env, provider, userId, encryptionSecret);
}

const CATALOG = {
  discord: [
    { name: "discord_get_user", description: "Get authenticated Discord user", inputSchema: { type: "object", properties: {} } },
    { name: "discord_list_guilds", description: "List Discord servers (guilds) for the user", inputSchema: { type: "object", properties: {} } }
  ],
  reddit: [
    { name: "reddit_me", description: "Get authenticated Reddit identity", inputSchema: { type: "object", properties: {} } },
    {
      name: "reddit_hot",
      description: "Hot posts from a subreddit",
      inputSchema: {
        type: "object",
        properties: { subreddit: { type: "string" }, limit: { type: "number" } },
        required: ["subreddit"]
      }
    }
  ],
  mailchimp: [
    { name: "mailchimp_ping", description: "Ping Mailchimp API", inputSchema: { type: "object", properties: {} } },
    {
      name: "mailchimp_list_audiences",
      description: "List audiences",
      inputSchema: { type: "object", properties: { count: { type: "number" } } }
    }
  ],
  spotify: [
    { name: "spotify_me", description: "Current Spotify user", inputSchema: { type: "object", properties: {} } },
    {
      name: "spotify_search",
      description: "Search Spotify",
      inputSchema: {
        type: "object",
        properties: {
          q: { type: "string" },
          type: { type: "string", description: "track,artist,album,playlist" },
          limit: { type: "number" }
        },
        required: ["q"]
      }
    }
  ],
  zoom: [
    { name: "zoom_me", description: "Authenticated Zoom user", inputSchema: { type: "object", properties: {} } },
    {
      name: "zoom_list_meetings",
      description: "List user meetings",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string", description: "scheduled|live|upcoming" } }
      }
    }
  ],
  twitch: [
    {
      name: "twitch_users",
      description: "Lookup Twitch user by login",
      inputSchema: {
        type: "object",
        properties: { login: { type: "string" } },
        required: ["login"]
      }
    }
  ],
  salesforce: [
    { name: "salesforce_identity", description: "User info / identity from Salesforce", inputSchema: { type: "object", properties: {} } },
    {
      name: "salesforce_query",
      description: "Run a SOQL query (read)",
      inputSchema: {
        type: "object",
        properties: { q: { type: "string", description: "SOQL e.g. SELECT Id, Name FROM Account LIMIT 5" } },
        required: ["q"]
      }
    }
  ],
  twitter: [
    { name: "twitter_me", description: "Authenticated X user", inputSchema: { type: "object", properties: {} } },
    {
      name: "twitter_search_recent",
      description: "Recent search (needs tweet.read + appropriate API access)",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" }, max_results: { type: "number" } },
        required: ["query"]
      }
    }
  ],
  wolfram: [
    {
      name: "wolfram_query",
      description: "Short answer from Wolfram Alpha",
      inputSchema: {
        type: "object",
        properties: { input: { type: "string" } },
        required: ["input"]
      }
    }
  ]
};

async function apiJson(url, headers) {
  const r = await fetch(url, { headers });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, j };
}

async function executeTool(env, provider, userId, name, args) {
  args = args || {};

  if (provider === "wolfram") {
    const appId = env.WOLFRAM_APP_ID;
    if (!appId) return toolResult({ error: "WOLFRAM_APP_ID not configured on worker" }, true);
    if (name !== "wolfram_query") return toolResult({ error: `Unknown tool ${name}` }, true);
    const input = encodeURIComponent(args.input || "");
    const r = await fetch(
      `https://api.wolframalpha.com/v1/result?i=${input}&appid=${encodeURIComponent(appId)}`
    );
    const text = await r.text();
    if (!r.ok) return toolResult({ error: text || r.statusText }, true);
    return toolResult({ answer: text });
  }

  const auth = await needToken(env, provider, userId);
  if (auth.error) return toolResult({ error: auth.message }, true);
  const { token } = auth;

  if (provider === "discord") {
    const headers = { Authorization: `Bearer ${token}` };
    if (name === "discord_get_user") {
      const { ok, j } = await apiJson("https://discord.com/api/v10/users/@me", headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "discord error" }, true);
    }
    if (name === "discord_list_guilds") {
      const { ok, j } = await apiJson("https://discord.com/api/v10/users/@me/guilds", headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "discord error" }, true);
    }
  }

  if (provider === "reddit") {
    const headers = {
      Authorization: `Bearer ${token}`,
      "User-Agent": "nexus-mcp-server/0.9.1 by nexus"
    };
    if (name === "reddit_me") {
      const { ok, j } = await apiJson("https://oauth.reddit.com/api/v1/me", headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "reddit error" }, true);
    }
    if (name === "reddit_hot") {
      const sub = String(args.subreddit || "").replace(/^r\//, "");
      const limit = Math.min(Number(args.limit) || 10, 25);
      const { ok, j } = await apiJson(
        `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/hot?limit=${limit}`,
        headers
      );
      if (!ok) return toolResult({ error: j.message || "reddit error" }, true);
      const posts = (j.data?.children || []).map((c) => ({
        title: c.data?.title,
        author: c.data?.author,
        score: c.data?.score,
        url: c.data?.url,
        permalink: c.data?.permalink ? `https://reddit.com${c.data.permalink}` : null
      }));
      return toolResult({ subreddit: sub, posts });
    }
  }

  if (provider === "mailchimp") {
    const metaR = await fetch("https://login.mailchimp.com/oauth2/metadata", {
      headers: { Authorization: `OAuth ${token}` }
    });
    const md = await metaR.json().catch(() => ({}));
    const base = md.api_endpoint || "https://us1.api.mailchimp.com";
    const headers = { Authorization: `OAuth ${token}` };
    if (name === "mailchimp_ping") {
      const { ok, j } = await apiJson(`${base}/3.0/ping`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.detail || "mailchimp error" }, true);
    }
    if (name === "mailchimp_list_audiences") {
      const count = Math.min(Number(args.count) || 10, 50);
      const { ok, j } = await apiJson(`${base}/3.0/lists?count=${count}`, headers);
      if (!ok) return toolResult({ error: j.detail || "mailchimp error" }, true);
      return toolResult({
        lists: (j.lists || []).map((l) => ({
          id: l.id,
          name: l.name,
          members: l.stats?.member_count
        }))
      });
    }
  }

  if (provider === "spotify") {
    const headers = { Authorization: `Bearer ${token}` };
    if (name === "spotify_me") {
      const { ok, j } = await apiJson("https://api.spotify.com/v1/me", headers);
      return ok ? toolResult(j) : toolResult({ error: j.error?.message || "spotify error" }, true);
    }
    if (name === "spotify_search") {
      const q = encodeURIComponent(args.q || "");
      const type = encodeURIComponent(args.type || "track,artist");
      const limit = Math.min(Number(args.limit) || 10, 20);
      const { ok, j } = await apiJson(
        `https://api.spotify.com/v1/search?q=${q}&type=${type}&limit=${limit}`,
        headers
      );
      return ok ? toolResult(j) : toolResult({ error: j.error?.message || "spotify error" }, true);
    }
  }

  if (provider === "zoom") {
    const headers = { Authorization: `Bearer ${token}` };
    if (name === "zoom_me") {
      const { ok, j } = await apiJson("https://api.zoom.us/v2/users/me", headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "zoom error" }, true);
    }
    if (name === "zoom_list_meetings") {
      const type = encodeURIComponent(args.type || "scheduled");
      const { ok, j } = await apiJson(
        `https://api.zoom.us/v2/users/me/meetings?type=${type}`,
        headers
      );
      return ok ? toolResult(j) : toolResult({ error: j.message || "zoom error" }, true);
    }
  }

  if (provider === "twitch") {
    const clientId = env.TWITCH_CLIENT_ID;
    if (!clientId) return toolResult({ error: "TWITCH_CLIENT_ID not set on worker" }, true);
    const headers = { Authorization: `Bearer ${token}`, "Client-Id": clientId };
    if (name === "twitch_users") {
      const login = encodeURIComponent(args.login || "");
      const { ok, j } = await apiJson(`https://api.twitch.tv/helix/users?login=${login}`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "twitch error" }, true);
    }
  }

  if (provider === "salesforce") {
    const record = await fullTokenRecord(env, provider, userId);
    const instance =
      record?.instance_url ||
      record?.instanceUrl ||
      env.SALESFORCE_INSTANCE_URL;
    if (!instance) {
      return toolResult(
        {
          error:
            "Salesforce instance_url missing on token record. Re-connect Salesforce OAuth or set SALESFORCE_INSTANCE_URL."
        },
        true
      );
    }
    const base = String(instance).replace(/\/$/, "");
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
    if (name === "salesforce_identity") {
      const { ok, j } = await apiJson(`${base}/services/oauth2/userinfo`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.error || j.error_description || "sf error" }, true);
    }
    if (name === "salesforce_query") {
      const q = encodeURIComponent(args.q || "");
      const { ok, j } = await apiJson(`${base}/services/data/v59.0/query?q=${q}`, headers);
      return ok ? toolResult(j) : toolResult({ error: j[0]?.message || j.message || "sf query error" }, true);
    }
  }

  if (provider === "twitter") {
    const headers = { Authorization: `Bearer ${token}` };
    if (name === "twitter_me") {
      const { ok, j } = await apiJson("https://api.x.com/2/users/me", headers);
      return ok ? toolResult(j) : toolResult({ error: j.detail || j.title || "x error" }, true);
    }
    if (name === "twitter_search_recent") {
      const query = encodeURIComponent(args.query || "");
      const max = Math.min(Number(args.max_results) || 10, 100);
      const { ok, j } = await apiJson(
        `https://api.x.com/2/tweets/search/recent?query=${query}&max_results=${max}`,
        headers
      );
      return ok ? toolResult(j) : toolResult({ error: j.detail || j.title || "x search error" }, true);
    }
  }

  return toolResult({ error: `Unknown tool ${name} for ${provider}` }, true);
}

export async function handleLocalMcp(request, env, provider, userId) {
  if (request.method === "GET") {
    return json({
      server: "nexus-mcp-server",
      provider,
      mode: "local-custom-mcp",
      tools: (CATALOG[provider] || []).map((t) => t.name)
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { id, method, params } = body || {};

  if (method === "initialize") {
    return rpcResult(id, {
      protocolVersion: params?.protocolVersion || "2025-06-18",
      capabilities: { tools: {} },
      serverInfo: { name: `nexus-${provider}-mcp`, version: "0.9.1" }
    });
  }
  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }
  if (method === "tools/list") {
    return rpcResult(id, { tools: CATALOG[provider] || [] });
  }
  if (method === "tools/call") {
    try {
      const result = await executeTool(env, provider, userId, params?.name, params?.arguments || {});
      return rpcResult(id, result);
    } catch (err) {
      return rpcResult(id, toolResult({ error: err.message || String(err) }, true));
    }
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
}
