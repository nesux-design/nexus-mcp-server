import { publicConnectorList } from "./config/connectors.js";
import { mcpToolCall, mcpToolsList } from "./src/mcp/proxy.js";
import { handleRealMcp } from "./src/mcp/real-server.js";
import { handleMcpTokenSync } from "./src/mcp/token-sync.js";
import { handleOAuth } from "./src/oauth/routes.js";
import { oauthProtectedResourceMetadata } from "./src/mcp/oauth-resource.js";
import { oauthAuthorizationServerMetadata } from "./src/mcp/oauth-server-metadata.js";
import { handleMcpAuthorize } from "./src/mcp/oauth-authorization.js";
import { handleMcpToken } from "./src/mcp/oauth-token.js";
import { SentryMcpServer } from "./src/mcp/sentry-mcp.js";
import { GoogleMcpServer } from "./src/mcp/google-mcp.js";
import { OAuthCodeStore } from "./src/mcp/oauth-code-store-do.js";
import { authenticateMcpRequest } from "./src/mcp/oauth-resource-auth.js";
import { requireInternalUser } from "./src/security/internal-auth.js";

const VERSION = "0.8.1";

// Only providers WITHOUT official remote MCP keep local wrappers.
// Cloudflare / Vercel / Netlify / Atlassian / Airtable / Supabase → pure official remote MCP.
const LOCAL_MCP_SERVERS = {
  sentry: SentryMcpServer,
  google: GoogleMcpServer
};

function baseHeaders(requestId) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-request-id": requestId,
    "x-nexus-version": VERSION
  };
}

function jsonHeaders(requestId) {
  return { ...baseHeaders(requestId), "content-type": "application/json" };
}

function oauthServerError(requestId, description) {
  return Response.json(
    { error: "temporarily_unavailable", error_description: description },
    { status: 503, headers: jsonHeaders(requestId) }
  );
}

async function handleLocalMcpTools(ServerClass, env, userId, requestId) {
  const server = new ServerClass(env);
  return Response.json({ tools: server.getToolDefinitions() }, { status: 200, headers: jsonHeaders(requestId) });
}

async function handleLocalMcpCall(ServerClass, request, env, userId, requestId) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON in request body" }, { status: 400, headers: jsonHeaders(requestId) });
  }
  const toolName = body.name || body.tool;
  const args = body.arguments || {};
  if (!toolName) {
    return Response.json({ error: "name (or tool) parameter is required" }, { status: 400, headers: jsonHeaders(requestId) });
  }
  const server = new ServerClass(env);
  const result = await server.handleToolCall(toolName, args, userId);
  return Response.json({ tool: toolName, result }, { status: 200, headers: jsonHeaders(requestId) });
}

async function resolveLegacyUser(request, env, provider) {
  const internalUserId = await requireInternalUser(request, env);
  if (internalUserId) return { userId: internalUserId };

  const canonicalResource = new URL(`/mcp/${provider}`, request.url).toString();
  const auth = await authenticateMcpRequest(request, env, provider, canonicalResource);
  if (auth.response) return { response: auth.response };
  return { userId: auth.userId };
}

export { OAuthCodeStore };

export default {
  async fetch(request, env) {
    const requestId = crypto.randomUUID();
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: baseHeaders(requestId) });
      }

      if (pathname === "/") {
        return Response.json(
          { server: "nexus-mcp-server", status: "ok", version: VERSION },
          { headers: jsonHeaders(requestId) }
        );
      }

      if (pathname === "/connectors" && request.method === "GET") {
        return Response.json(
          { server: "nexus-mcp-server", version: VERSION, connectors: publicConnectorList() },
          { headers: jsonHeaders(requestId) }
        );
      }

      if (
        [
          "/.well-known/oauth-authorization-server",
          "/.well-known/oauth-authorization-server/oauth",
          "/.well-known/openid-configuration/oauth",
          "/oauth/.well-known/openid-configuration"
        ].includes(pathname) &&
        request.method === "GET"
      ) {
        const response = oauthAuthorizationServerMetadata(request);
        response.headers.set("x-request-id", requestId);
        response.headers.set("x-nexus-version", VERSION);
        return response;
      }

      if (pathname === "/oauth/authorize") {
        try {
          const response = await handleMcpAuthorize(request, env);
          const headers = new Headers(response.headers);
          headers.set("x-request-id", requestId);
          headers.set("x-nexus-version", VERSION);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
        } catch (error) {
          console.error("MCP OAuth authorization route failed", {
            error: error instanceof Error ? error.message : String(error)
          });
          return oauthServerError(requestId, "OAuth authorization is temporarily unavailable");
        }
      }

      if (pathname === "/oauth/token") {
        try {
          const response = await handleMcpToken(request, env);
          const headers = new Headers(response.headers);
          headers.set("x-request-id", requestId);
          headers.set("x-nexus-version", VERSION);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers
          });
        } catch (error) {
          console.error("MCP OAuth token route failed", {
            error: error instanceof Error ? error.message : String(error)
          });
          return oauthServerError(requestId, "OAuth token service is temporarily unavailable");
        }
      }

      const metadataMatch = pathname.match(
        /^\/\.well-known\/oauth-protected-resource\/mcp\/([a-zA-Z0-9_-]+)$/
      );
      if (metadataMatch && request.method === "GET") {
        if (!publicConnectorList().some((item) => item.id === metadataMatch[1])) {
          return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
        }
        const response = oauthProtectedResourceMetadata(request, metadataMatch[1]);
        response.headers.set("x-request-id", requestId);
        response.headers.set("x-nexus-version", VERSION);
        return response;
      }

      const tokenSync = pathname.match(/^\/internal\/mcp-token\/([a-zA-Z0-9_-]+)$/);
      if (tokenSync) {
        const response = await handleMcpTokenSync(request, env);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      const oauthResponse = await handleOAuth(request, env, pathname);
      if (oauthResponse) {
        const headers = new Headers(oauthResponse.headers);
        headers.set("x-request-id", requestId);
        headers.set("x-nexus-version", VERSION);
        return new Response(oauthResponse.body, {
          status: oauthResponse.status,
          statusText: oauthResponse.statusText,
          headers
        });
      }

      // Real MCP path: /mcp/<provider> → official remote or local fallback
      const realMcpMatch = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
      if (realMcpMatch) {
        const response = await handleRealMcp(request, env, realMcpMatch[1]);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      // Legacy local tools only for Sentry / Google
      const localToolsMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/tools$/);
      if (localToolsMatch && request.method === "POST" && LOCAL_MCP_SERVERS[localToolsMatch[1]]) {
        const auth = await resolveLegacyUser(request, env, localToolsMatch[1]);
        if (auth.response) return auth.response;
        return await handleLocalMcpTools(
          LOCAL_MCP_SERVERS[localToolsMatch[1]],
          env,
          auth.userId,
          requestId
        );
      }

      const localCallMatch = pathname.match(/^\/([a-zA-Z0-9_-]+)\/call$/);
      if (localCallMatch && request.method === "POST" && LOCAL_MCP_SERVERS[localCallMatch[1]]) {
        const auth = await resolveLegacyUser(request, env, localCallMatch[1]);
        if (auth.response) return auth.response;
        return await handleLocalMcpCall(
          LOCAL_MCP_SERVERS[localCallMatch[1]],
          request,
          env,
          auth.userId,
          requestId
        );
      }

      const toolsMatch = pathname.match(/^\/gateway\/([a-zA-Z0-9_-]+)\/tools$/);
      if (toolsMatch && request.method === "POST") {
        const response = await mcpToolsList(request, env, toolsMatch[1]);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      const callMatch = pathname.match(/^\/gateway\/([a-zA-Z0-9_-]+)\/call$/);
      if (callMatch && request.method === "POST") {
        const response = await mcpToolCall(request, env, callMatch[1]);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
    } catch (err) {
      console.error("Worker fetch error:", err);
      return Response.json(
        { error: "Internal server error", requestId },
        { status: 500, headers: jsonHeaders(requestId) }
      );
    }
  }
};
