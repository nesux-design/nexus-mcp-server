/**
 * Custom local MCP handlers for providers without official remote MCP.
 * Protocol: JSON-RPC initialize | tools/list | tools/call
 * Auth: stored OAuth token (oauth2) or env API key.
 */

import { getOAuthAccessToken } from "./proxy.js";

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
    isError: isError || (obj && obj.error)
  };
}

async function needToken(env, provider, userId) {
  const token = await getOAuthAccessToken(env, provider, userId);
  if (!token) {
    return {
      error: true,
      message: `No OAuth token for ${provider}. Connect via nexus-a1 OAuth first, then retry.`
    };
  }
  return { token };
}

const CATALOG = {
  discord: [
    {
      name: "discord_get_user",
      description: "Get the authenticated Discord user profile",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "discord_list_guilds",
      description: "List guilds (servers) the user is in",
      inputSchema: { type: "object", properties: {}, required: [] }
    }
  ],
  reddit: [
    {
      name: "reddit_me",
      description: "Get the authenticated Reddit user",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "reddit_hot",
      description: "Fetch hot posts from a subreddit",
      inputSchema: {
        type: "object",
        properties: {
          subreddit: { type: "string", description: "e.g. programming" },
          limit: { type: "number" }
        },
        required: ["subreddit"]
      }
    }
  ],
  mailchimp: [
    {
      name: "mailchimp_ping",
      description: "Ping Mailchimp API and return account metadata",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "mailchimp_list_audiences",
      description: "List Mailchimp audiences (lists)",
      inputSchema: {
        type: "object",
        properties: { count: { type: "number" } },
        required: []
      }
    }
  ],
  spotify: [
    {
      name: "spotify_me",
      description: "Get the current Spotify user profile",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "spotify_search",
      description: "Search Spotify catalog",
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
    {
      name: "zoom_me",
      description: "Get the authenticated Zoom user",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "zoom_list_meetings",
      description: "List upcoming scheduled meetings for the user",
      inputSchema: {
        type: "object",
        properties: { type: { type: "string", description: "scheduled|live|upcoming" } },
        required: []
      }
    }
  ],
  twitch: [
    {
      name: "twitch_users",
      description: "Get Twitch user(s) by login name",
      inputSchema: {
        type: "object",
        properties: { login: { type: "string" } },
        required: ["login"]
      }
    }
  ],
  wolfram: [
    {
      name: "wolfram_query",
      description: "Query Wolfram Alpha short answers",
      inputSchema: {
        type: "object",
        properties: { input: { type: "string" } },
        required: ["input"]
      }
    }
  ]
};

async function callDiscord(token, name) {
  const headers = { Authorization: `Bearer ${token}`, "User-Agent": "NexusMCP (discord, 0.9)" };
  if (name === "discord_get_user") {
    const r = await fetch("https://discord.com/api/v10/users/@me", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  if (name === "discord_list_guilds") {
    const r = await fetch("https://discord.com/api/v10/users/@me/guilds", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callReddit(token, name, args) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "nexus-mcp-server/0.9 by nexus"
  };
  if (name === "reddit_me") {
    const r = await fetch("https://oauth.reddit.com/api/v1/me", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  if (name === "reddit_hot") {
    const sub = String(args.subreddit || "").replace(/^r\//, "");
    const limit = Math.min(Number(args.limit) || 10, 25);
    const r = await fetch(
      `https://oauth.reddit.com/r/${encodeURIComponent(sub)}/hot?limit=${limit}`,
      { headers }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    const posts = (j.data?.children || []).map((c) => ({
      title: c.data?.title,
      author: c.data?.author,
      score: c.data?.score,
      url: c.data?.url,
      permalink: c.data?.permalink ? `https://reddit.com${c.data.permalink}` : null
    }));
    return toolResult({ subreddit: sub, posts });
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callMailchimp(token, name, args) {
  // Mailchimp OAuth token often needs dc from metadata; try us1 as fallback via metadata endpoint
  const meta = await fetch("https://login.mailchimp.com/oauth2/metadata", {
    headers: { Authorization: `OAuth ${token}` }
  });
  const md = await meta.json().catch(() => ({}));
  const base = md.api_endpoint || "https://us1.api.mailchimp.com";
  const headers = { Authorization: `OAuth ${token}` };
  if (name === "mailchimp_ping") {
    const r = await fetch(`${base}/3.0/ping`, { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.detail || r.statusText }, true);
    return toolResult(j);
  }
  if (name === "mailchimp_list_audiences") {
    const count = Math.min(Number(args.count) || 10, 50);
    const r = await fetch(`${base}/3.0/lists?count=${count}`, { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.detail || r.statusText }, true);
    return toolResult({
      lists: (j.lists || []).map((l) => ({
        id: l.id,
        name: l.name,
        members: l.stats?.member_count
      }))
    });
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callSpotify(token, name, args) {
  const headers = { Authorization: `Bearer ${token}` };
  if (name === "spotify_me") {
    const r = await fetch("https://api.spotify.com/v1/me", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.error?.message || r.statusText }, true);
    return toolResult(j);
  }
  if (name === "spotify_search") {
    const q = encodeURIComponent(args.q || "");
    const type = encodeURIComponent(args.type || "track,artist");
    const limit = Math.min(Number(args.limit) || 10, 20);
    const r = await fetch(
      `https://api.spotify.com/v1/search?q=${q}&type=${type}&limit=${limit}`,
      { headers }
    );
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.error?.message || r.statusText }, true);
    return toolResult(j);
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callZoom(token, name, args) {
  const headers = { Authorization: `Bearer ${token}` };
  if (name === "zoom_me") {
    const r = await fetch("https://api.zoom.us/v2/users/me", { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  if (name === "zoom_list_meetings") {
    const type = args.type || "scheduled";
    const r = await fetch(`https://api.zoom.us/v2/users/me/meetings?type=${encodeURIComponent(type)}`, {
      headers
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callTwitch(env, token, name, args) {
  const clientId = env.TWITCH_CLIENT_ID || env.ADD_YOUR_TWITCH_CLIENT_ID;
  if (!clientId) {
    return toolResult({ error: "TWITCH_CLIENT_ID not configured on worker" }, true);
  }
  const headers = {
    Authorization: `Bearer ${token}`,
    "Client-Id": clientId
  };
  if (name === "twitch_users") {
    const login = encodeURIComponent(args.login || "");
    const r = await fetch(`https://api.twitch.tv/helix/users?login=${login}`, { headers });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return toolResult({ error: j.message || r.statusText }, true);
    return toolResult(j);
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function callWolfram(env, name, args) {
  const appId = env.WOLFRAM_APP_ID;
  if (!appId) return toolResult({ error: "WOLFRAM_APP_ID not configured" }, true);
  if (name === "wolfram_query") {
    const input = encodeURIComponent(args.input || "");
    const r = await fetch(
      `https://api.wolframalpha.com/v1/result?i=${input}&appid=${encodeURIComponent(appId)}`
    );
    const text = await r.text();
    if (!r.ok) return toolResult({ error: text || r.statusText }, true);
    return toolResult({ answer: text });
  }
  return toolResult({ error: `Unknown tool ${name}` }, true);
}

async function executeTool(env, provider, userId, name, args) {
  if (provider === "wolfram") return callWolfram(env, name, args || {});

  const auth = await needToken(env, provider, userId);
  if (auth.error) return toolResult({ error: auth.message }, true);
  const { token } = auth;

  if (provider === "discord") return callDiscord(token, name);
  if (provider === "reddit") return callReddit(token, name, args || {});
  if (provider === "mailchimp") return callMailchimp(token, name, args || {});
  if (provider === "spotify") return callSpotify(token, name, args || {});
  if (provider === "zoom") return callZoom(token, name, args || {});
  if (provider === "twitch") return callTwitch(env, token, name, args || {});
  return toolResult({ error: `No local tools for ${provider}` }, true);
}

export async function handleLocalMcp(request, env, provider, userId) {
  if (request.method === "GET") {
    return json({
      server: "nexus-mcp-server",
      provider,
      mode: "local-custom-mcp",
      message: "POST JSON-RPC: initialize | tools/list | tools/call"
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
      serverInfo: { name: `nexus-${provider}-mcp`, version: "0.9.0" }
    });
  }
  if (method === "notifications/initialized") {
    return new Response(null, { status: 204 });
  }
  if (method === "tools/list") {
    const tools = CATALOG[provider] || [];
    return rpcResult(id, { tools });
  }
  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    try {
      const result = await executeTool(env, provider, userId, name, args);
      return rpcResult(id, result);
    } catch (err) {
      return rpcResult(id, toolResult({ error: err.message || String(err) }, true));
    }
  }
  return rpcError(id, -32601, `Method not found: ${method}`);
}
