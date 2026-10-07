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
  github: [
    { name: "github_me", description: "Get the authenticated GitHub user", inputSchema: { type: "object", properties: {} } },
    { name: "github_list_repositories", description: "List repositories accessible to the authenticated GitHub user", inputSchema: { type: "object", properties: { per_page: { type: "number" }, page: { type: "number" } } } },
    { name: "github_get_repository", description: "Get repository metadata", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" } }, required: ["owner", "repo"] } },
    { name: "github_get_file", description: "Read a file from a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, ref: { type: "string" } }, required: ["owner", "repo", "path"] } },
    { name: "github_search_repositories", description: "Search GitHub repositories", inputSchema: { type: "object", properties: { q: { type: "string" }, per_page: { type: "number" } }, required: ["q"] } },
    { name: "github_list_issues", description: "List repository issues", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, state: { type: "string" }, per_page: { type: "number" } }, required: ["owner", "repo"] } },
    { name: "github_create_issue", description: "Create an issue in a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, title: { type: "string" }, body: { type: "string" } }, required: ["owner", "repo", "title"] } },
    { name: "github_list_pull_requests", description: "List pull requests in a repository", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, state: { type: "string" }, per_page: { type: "number" } }, required: ["owner", "repo"] } },
    { name: "github_create_or_update_file", description: "Create or update a repository file", inputSchema: { type: "object", properties: { owner: { type: "string" }, repo: { type: "string" }, path: { type: "string" }, content: { type: "string" }, message: { type: "string" }, branch: { type: "string" }, sha: { type: "string" } }, required: ["owner", "repo", "path", "content", "message"] } }
  ],
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
  const raw = await r.text();
  let j = {};
  try {
    j = raw ? JSON.parse(raw) : {};
  } catch {
    j = { raw };
  }
  return { ok: r.ok, status: r.status, j, raw, contentType: r.headers.get("content-type") || "" };
}

function githubApiError(result) {
  const message =
    result?.j?.message ||
    result?.j?.error ||
    result?.j?.error_description ||
    (typeof result?.j?.raw === "string" ? result.j.raw : "") ||
    result?.raw ||
    "GitHub API error";
  return {
    error: message,
    status: result?.status ?? null,
    content_type: result?.contentType || null
  };
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

  if (provider === "github") {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "nexus-mcp-server"
    };
    const api = "https://api.github.com";
    const owner = String(args.owner || "").trim();
    const repoName = String(args.repo || "").trim();
    if (name === "github_me") {
      const result = await apiJson(`${api}/user`, headers);
      return result.ok ? toolResult(result.j) : toolResult(githubApiError(result), true);
    }
    if (name === "github_list_repositories") {
      const perPage = Math.min(Math.max(Number(args.per_page) || 30, 1), 100);
      const page = Math.max(Number(args.page) || 1, 1);
      const result = await apiJson(`${api}/user/repos?per_page=${perPage}&page=${page}&sort=updated`, headers);
      return result.ok ? toolResult(result.j) : toolResult(githubApiError(result), true);
    }
    if (name === "github_get_repository") {
      if (!owner || !repoName) return toolResult({ error: "owner and repo are required" }, true);
      const result = await apiJson(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}`, headers);
      return result.ok ? toolResult(result.j) : toolResult(githubApiError(result), true);
    }
    if (name === "github_get_file") {
      if (!owner || !repoName || !args.path) return toolResult({ error: "owner, repo and path are required" }, true);
      const path = String(args.path).split("/").map(encodeURIComponent).join("/");
      const ref = args.ref ? `?ref=${encodeURIComponent(String(args.ref))}` : "";
      const { ok, j } = await apiJson(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/${path}${ref}`, headers);
      if (!ok) return toolResult({ error: j.message || "GitHub API error" }, true);
      if (Array.isArray(j)) return toolResult(j);
      if (j.encoding === "base64" && typeof j.content === "string") {
        const bytes = Uint8Array.from(atob(j.content.replace(/\\s/g, "")), ch => ch.charCodeAt(0));
        j.content = new TextDecoder().decode(bytes);
        delete j.encoding;
      }
      return toolResult(j);
    }
    if (name === "github_search_repositories") {
      const q = encodeURIComponent(String(args.q || ""));
      if (!q) return toolResult({ error: "q is required" }, true);
      const perPage = Math.min(Math.max(Number(args.per_page) || 20, 1), 100);
      const { ok, j } = await apiJson(`${api}/search/repositories?q=${q}&per_page=${perPage}`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "GitHub API error" }, true);
    }
    if (name === "github_list_issues") {
      if (!owner || !repoName) return toolResult({ error: "owner and repo are required" }, true);
      const state = ["open","closed","all"].includes(String(args.state)) ? String(args.state) : "open";
      const perPage = Math.min(Math.max(Number(args.per_page) || 30, 1), 100);
      const { ok, j } = await apiJson(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/issues?state=${state}&per_page=${perPage}`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "GitHub API error" }, true);
    }
    if (name === "github_create_issue") {
      if (!owner || !repoName || !args.title) return toolResult({ error: "owner, repo and title are required" }, true);
      const response = await fetch(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/issues`, {
        method: "POST", headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ title: String(args.title), ...(args.body ? { body: String(args.body) } : {}) })
      });
      const j = await response.json().catch(() => ({}));
      return response.ok ? toolResult(j) : toolResult({ error: j.message || "GitHub API error" }, true);
    }
    if (name === "github_list_pull_requests") {
      if (!owner || !repoName) return toolResult({ error: "owner and repo are required" }, true);
      const state = ["open","closed","all"].includes(String(args.state)) ? String(args.state) : "open";
      const perPage = Math.min(Math.max(Number(args.per_page) || 30, 1), 100);
      const { ok, j } = await apiJson(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/pulls?state=${state}&per_page=${perPage}`, headers);
      return ok ? toolResult(j) : toolResult({ error: j.message || "GitHub API error" }, true);
    }
    if (name === "github_create_or_update_file") {
      if (!owner || !repoName || !args.path || !args.message) return toolResult({ error: "owner, repo, path and message are required" }, true);
      const content = btoa(unescape(encodeURIComponent(String(args.content || ""))));
      const body = { message: String(args.message), content, ...(args.branch ? { branch: String(args.branch) } : {}), ...(args.sha ? { sha: String(args.sha) } : {}) };
      const response = await fetch(`${api}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/contents/${String(args.path).split("/").map(encodeURIComponent).join("/")}`, {
        method: "PUT", headers: { ...headers, "content-type": "application/json" }, body: JSON.stringify(body)
      });
      const j = await response.json().catch(() => ({}));
      return response.ok ? toolResult(j) : toolResult({ error: j.message || "GitHub API error" }, true);
    }
  }

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
      serverInfo: { name: `nexus-${provider}-mcp`, version: "0.10.6" }
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
