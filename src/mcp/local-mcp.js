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
  googleDrive: [
    { name: "gdrive_list_files", description: "List Google Drive files and folders", inputSchema: { type: "object", properties: { page_size: { type: "number" }, page_token: { type: "string" }, q: { type: "string" }, order_by: { type: "string" }, folder_id: { type: "string" } } } },
    { name: "gdrive_search_files", description: "Search Google Drive files by name or full text", inputSchema: { type: "object", properties: { q: { type: "string" }, page_size: { type: "number" }, page_token: { type: "string" } }, required: ["q"] } },
    { name: "gdrive_get_file", description: "Get Google Drive file metadata by ID", inputSchema: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"] } },
    { name: "gdrive_download_file", description: "Download Google Drive file content", inputSchema: { type: "object", properties: { file_id: { type: "string" } }, required: ["file_id"] } }
  ],
  googleCalendar: [
    { name: "gcal_list_calendars", description: "List Google Calendar calendars", inputSchema: { type: "object", properties: {} } },
    { name: "gcal_list_events", description: "List events from a Google Calendar", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, time_min: { type: "string" }, time_max: { type: "string" }, q: { type: "string" }, max_results: { type: "number" }, page_token: { type: "string" }, single_events: { type: "boolean" }, order_by: { type: "string" } } } },
    { name: "gcal_get_event", description: "Get a Google Calendar event", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, event_id: { type: "string" } }, required: ["event_id"] } },
    { name: "gcal_search_events", description: "Search Google Calendar events by text", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, q: { type: "string" }, time_min: { type: "string" }, time_max: { type: "string" }, max_results: { type: "number" }, page_token: { type: "string" } }, required: ["q"] } },
    { name: "gcal_create_event", description: "Create a Google Calendar event", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, summary: { type: "string" }, description: { type: "string" }, location: { type: "string" }, start: { type: "object" }, end: { type: "object" }, attendees: { type: "array" }, time_zone: { type: "string" } }, required: ["summary", "start", "end"] } },
    { name: "gcal_update_event", description: "Update a Google Calendar event", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, event_id: { type: "string" }, summary: { type: "string" }, description: { type: "string" }, location: { type: "string" }, start: { type: "object" }, end: { type: "object" }, attendees: { type: "array" }, time_zone: { type: "string" } }, required: ["event_id"] } },
    { name: "gcal_delete_event", description: "Delete a Google Calendar event", inputSchema: { type: "object", properties: { calendar_id: { type: "string" }, event_id: { type: "string" } }, required: ["event_id"] } }
  ],
  figma: [
    { name: "figma_me", description: "Get the authenticated Figma user", inputSchema: { type: "object", properties: {} } },
    { name: "figma_get_file", description: "Get a Figma file document and metadata", inputSchema: { type: "object", properties: { file_key: { type: "string" }, version: { type: "string" }, ids: { type: "string" }, depth: { type: "number" }, branch_data: { type: "boolean" } }, required: ["file_key"] } },
    { name: "figma_get_file_nodes", description: "Get specific Figma nodes and their subtrees", inputSchema: { type: "object", properties: { file_key: { type: "string" }, ids: { type: "string" }, version: { type: "string" }, depth: { type: "number" } }, required: ["file_key", "ids"] } },
    { name: "figma_get_file_metadata", description: "Get lightweight Figma file metadata", inputSchema: { type: "object", properties: { file_key: { type: "string" } }, required: ["file_key"] } },
    { name: "figma_render_images", description: "Render Figma nodes as PNG/JPG/SVG/PDF images", inputSchema: { type: "object", properties: { file_key: { type: "string" }, ids: { type: "string" }, scale: { type: "number" }, format: { type: "string", enum: ["jpg", "png", "svg", "pdf"] }, svg_outline_text: { type: "boolean" } }, required: ["file_key", "ids"] } },
    { name: "figma_get_image_fills", description: "Get download URLs for image fills in a Figma file", inputSchema: { type: "object", properties: { file_key: { type: "string" } }, required: ["file_key"] } },
    { name: "figma_list_comments", description: "List comments on a Figma file", inputSchema: { type: "object", properties: { file_key: { type: "string" }, as_md: { type: "boolean" } }, required: ["file_key"] } },
    { name: "figma_post_comment", description: "Post a comment to a Figma file", inputSchema: { type: "object", properties: { file_key: { type: "string" }, message: { type: "string" }, client_meta: { type: "object" } }, required: ["file_key", "message"] } }
  ],
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

  if (provider === "googleDrive") {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "User-Agent": "nexus-mcp-server"
    };
    const api = "https://www.googleapis.com/drive/v3";
    const fields = "nextPageToken,incompleteSearch,files(id,name,mimeType,size,modifiedTime,createdTime,webViewLink,parents,description,trashed)";

    if (name === "gdrive_list_files" || name === "gdrive_search_files") {
      const params = new URLSearchParams();
      params.set("pageSize", String(Math.min(Math.max(Number(args.page_size) || 20, 1), 100)));
      params.set("fields", fields);
      params.set("spaces", "drive");
      params.set("orderBy", String(args.order_by || "modifiedTime desc"));
      if (args.page_token) params.set("pageToken", String(args.page_token));

      let q = String(args.q || "").trim();
      if (name === "gdrive_search_files") {
        if (!q) return toolResult({ error: "q is required" }, true);
        const escaped = q.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        q = `name contains '${escaped}' and trashed = false`;
      } else if (args.folder_id) {
        const folderId = String(args.folder_id).replace(/'/g, "\\'");
        q = `'${folderId}' in parents and trashed = false`;
      } else if (!q) {
        q = "trashed = false";
      }
      params.set("q", q);

      const result = await apiJson(`${api}/files?${params.toString()}`, headers);
      return result.ok
        ? toolResult(result.j)
        : toolResult({
            error: result.j?.error?.message || result.j?.message || result.raw || "Google Drive API error",
            status: result.status
          }, true);
    }

    if (name === "gdrive_get_file") {
      if (!args.file_id) return toolResult({ error: "file_id is required" }, true);
      const params = new URLSearchParams({ fields });
      const result = await apiJson(
        `${api}/files/${encodeURIComponent(String(args.file_id))}?${params.toString()}`,
        headers
      );
      return result.ok
        ? toolResult(result.j)
        : toolResult({
            error: result.j?.error?.message || result.j?.message || result.raw || "Google Drive API error",
            status: result.status
          }, true);
    }

    if (name === "gdrive_download_file") {
      if (!args.file_id) return toolResult({ error: "file_id is required" }, true);
      const response = await fetch(
        `${api}/files/${encodeURIComponent(String(args.file_id))}?alt=media`,
        { headers }
      );
      const raw = await response.text();
      if (!response.ok) {
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch {}
        return toolResult({
          error: body?.error?.message || raw || "Google Drive download error",
          status: response.status
        }, true);
      }
      return toolResult({ file_id: String(args.file_id), content: raw });
    }
  }

  if (provider === "googleCalendar") {
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "nexus-mcp-server"
    };
    const api = "https://www.googleapis.com/calendar/v3";
    const calendarId = encodeURIComponent(String(args.calendar_id || "primary"));

    if (name === "gcal_list_calendars") {
      const result = await apiJson(`${api}/users/me/calendarList?maxResults=250`, headers);
      return result.ok
        ? toolResult(result.j)
        : toolResult({ error: result.j?.error?.message || result.raw || "Google Calendar API error", status: result.status }, true);
    }

    if (name === "gcal_list_events" || name === "gcal_search_events") {
      if (name === "gcal_search_events" && !String(args.q || "").trim()) {
        return toolResult({ error: "q is required" }, true);
      }
      const params = new URLSearchParams();
      params.set("maxResults", String(Math.min(Math.max(Number(args.max_results) || 20, 1), 250)));
      params.set("singleEvents", String(args.single_events !== false));
      params.set("orderBy", String(args.order_by || "startTime"));
      if (args.page_token) params.set("pageToken", String(args.page_token));
      if (args.time_min) params.set("timeMin", String(args.time_min));
      if (args.time_max) params.set("timeMax", String(args.time_max));
      if (args.q) params.set("q", String(args.q));
      const result = await apiJson(`${api}/calendars/${calendarId}/events?${params.toString()}`, headers);
      return result.ok
        ? toolResult(result.j)
        : toolResult({ error: result.j?.error?.message || result.raw || "Google Calendar API error", status: result.status }, true);
    }

    if (name === "gcal_get_event") {
      if (!args.event_id) return toolResult({ error: "event_id is required" }, true);
      const result = await apiJson(
        `${api}/calendars/${calendarId}/events/${encodeURIComponent(String(args.event_id))}`,
        headers
      );
      return result.ok
        ? toolResult(result.j)
        : toolResult({ error: result.j?.error?.message || result.raw || "Google Calendar API error", status: result.status }, true);
    }

    if (name === "gcal_create_event" || name === "gcal_update_event") {
      if (name === "gcal_update_event" && !args.event_id) {
        return toolResult({ error: "event_id is required" }, true);
      }
      const event = {};
      for (const key of ["summary", "description", "location"]) {
        if (args[key] !== undefined) event[key] = String(args[key]);
      }
      if (args.start) event.start = args.start;
      if (args.end) event.end = args.end;
      if (args.attendees) event.attendees = args.attendees;
      if (args.time_zone) {
        if (event.start && !event.start.timeZone) event.start.timeZone = String(args.time_zone);
        if (event.end && !event.end.timeZone) event.end.timeZone = String(args.time_zone);
      }
      if (name === "gcal_create_event") {
        if (!args.summary || !args.start || !args.end) {
          return toolResult({ error: "summary, start and end are required" }, true);
        }
        const response = await fetch(`${api}/calendars/${calendarId}/events`, {
          method: "POST",
          headers,
          body: JSON.stringify(event)
        });
        const raw = await response.text();
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch {}
        return response.ok
          ? toolResult(body)
          : toolResult({ error: body?.error?.message || raw || "Google Calendar create error", status: response.status }, true);
      }
      const response = await fetch(
        `${api}/calendars/${calendarId}/events/${encodeURIComponent(String(args.event_id))}`,
        { method: "PATCH", headers, body: JSON.stringify(event) }
      );
      const raw = await response.text();
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch {}
      return response.ok
        ? toolResult(body)
        : toolResult({ error: body?.error?.message || raw || "Google Calendar update error", status: response.status }, true);
    }

    if (name === "gcal_delete_event") {
      if (!args.event_id) return toolResult({ error: "event_id is required" }, true);
      const response = await fetch(
        `${api}/calendars/${calendarId}/events/${encodeURIComponent(String(args.event_id))}`,
        { method: "DELETE", headers }
      );
      const raw = await response.text();
      if (!response.ok) {
        let body = {};
        try { body = raw ? JSON.parse(raw) : {}; } catch {}
        return toolResult({ error: body?.error?.message || raw || "Google Calendar delete error", status: response.status }, true);
      }
      return toolResult({ deleted: true, event_id: String(args.event_id) });
    }
  }

  if (provider === "figma") {
    const headers = { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "nexus-mcp-server" };
    const api = "https://api.figma.com/v1";
    const fileKey = String(args.file_key || "").trim();

    if (name === "figma_me") {
      const result = await apiJson(`${api}/me`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_get_file" || name === "figma_get_file_nodes") {
      if (!fileKey) return toolResult({ error: "file_key is required" }, true);
      if (name === "figma_get_file_nodes" && !String(args.ids || "").trim()) return toolResult({ error: "ids is required" }, true);
      const params = new URLSearchParams();
      if (args.version) params.set("version", String(args.version));
      if (args.ids) params.set("ids", String(args.ids));
      if (args.depth !== undefined) {
        const depth = Number(args.depth);
        if (!Number.isInteger(depth) || depth < 1) return toolResult({ error: "depth must be a positive integer" }, true);
        params.set("depth", String(depth));
      }
      if (name === "figma_get_file" && args.branch_data !== undefined) params.set("branch_data", String(Boolean(args.branch_data)));
      const path = name === "figma_get_file_nodes" ? `${api}/files/${encodeURIComponent(fileKey)}/nodes` : `${api}/files/${encodeURIComponent(fileKey)}`;
      const result = await apiJson(`${path}${params.toString() ? `?${params}` : ""}`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.j?.err || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_get_file_metadata") {
      if (!fileKey) return toolResult({ error: "file_key is required" }, true);
      const result = await apiJson(`${api}/files/${encodeURIComponent(fileKey)}/meta`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_render_images") {
      if (!fileKey || !String(args.ids || "").trim()) return toolResult({ error: "file_key and ids are required" }, true);
      const params = new URLSearchParams({ ids: String(args.ids) });
      if (args.scale !== undefined) {
        const scale = Number(args.scale);
        if (!Number.isFinite(scale) || scale < 0.01 || scale > 4) return toolResult({ error: "scale must be between 0.01 and 4" }, true);
        params.set("scale", String(scale));
      }
      const format = String(args.format || "png").toLowerCase();
      if (!["jpg", "png", "svg", "pdf"].includes(format)) return toolResult({ error: "format must be jpg, png, svg, or pdf" }, true);
      params.set("format", format);
      if (args.svg_outline_text !== undefined) params.set("svg_outline_text", String(Boolean(args.svg_outline_text)));
      const result = await apiJson(`${api}/images/${encodeURIComponent(fileKey)}?${params}`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.j?.err || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_get_image_fills") {
      if (!fileKey) return toolResult({ error: "file_key is required" }, true);
      const result = await apiJson(`${api}/files/${encodeURIComponent(fileKey)}/images`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_list_comments") {
      if (!fileKey) return toolResult({ error: "file_key is required" }, true);
      const query = args.as_md === undefined ? "" : `?as_md=${encodeURIComponent(String(Boolean(args.as_md)))}`;
      const result = await apiJson(`${api}/files/${encodeURIComponent(fileKey)}/comments${query}`, headers);
      return result.ok ? toolResult(result.j) : toolResult({ error: result.j?.message || result.raw || "Figma API error", status: result.status }, true);
    }
    if (name === "figma_post_comment") {
      if (!fileKey || !String(args.message || "").trim()) return toolResult({ error: "file_key and message are required" }, true);
      const response = await fetch(`${api}/files/${encodeURIComponent(fileKey)}/comments`, {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ message: String(args.message), ...(args.client_meta ? { client_meta: args.client_meta } : {}) })
      });
      const raw = await response.text();
      let body = {};
      try { body = raw ? JSON.parse(raw) : {}; } catch {}
      return response.ok ? toolResult(body) : toolResult({ error: body?.message || body?.err || raw || "Figma comment error", status: response.status }, true);
    }
  }

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
