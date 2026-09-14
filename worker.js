import { publicConnectorList } from "./config/connectors.js";
import { mcpToolCall, mcpToolsList } from "./src/mcp/proxy.js";
import { handleRealMcp } from "./src/mcp/real-server.js";
import { handleMcpTokenSync } from "./src/mcp/token-sync.js";
import { handleOAuth } from "./src/oauth/routes.js";
import { oauthProtectedResourceMetadata } from "./src/mcp/oauth-resource.js";
import { oauthAuthorizationServerMetadata } from "./src/mcp/oauth-server-metadata.js";
import { handleMcpAuthorize } from "./src/mcp/oauth-authorization.js";
import { handleMcpToken } from "./src/mcp/oauth-token.js";
import { OAuthCodeStore } from "./src/mcp/oauth-code-store-do.js";
import { handleCustomConnectorApi } from "./src/mcp/custom-connectors.js";
import { proxyCustomMcp } from "./src/mcp/custom-proxy.js";
import { handleCustomOAuth } from "./src/mcp/custom-oauth.js";
import { requireInternalUser } from "./src/security/internal-auth.js";

const VERSION = "0.10.3";

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

function withMeta(response, requestId) {
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-nexus-version", VERSION);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
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
          {
            server: "nexus-mcp-server",
            status: "ok",
            version: VERSION,
            features: ["catalog-mcp", "custom-mcp-connect"]
          },
          { headers: jsonHeaders(requestId) }
        );
      }

      if (pathname === "/connectors" && request.method === "GET") {
        return Response.json(
          {
            server: "nexus-mcp-server",
            version: VERSION,
            connectors: publicConnectorList(),
            customMcp: {
              list: "GET /custom-mcp",
              add: "POST /custom-mcp",
              remove: "DELETE /custom-mcp/:id",
              use: "POST /mcp/custom/:id"
            }
          },
          { headers: jsonHeaders(requestId) }
        );
      }

      // --- Claude/Grok-style custom MCP registry ---
      if (pathname === "/custom-mcp" || pathname.startsWith("/custom-mcp/")) {
        const userId = await requireInternalUser(request, env);
        if (!userId) {
          return Response.json(
            { error: "Unauthorized", message: "X-Nexus-User-Id + X-Nexus-Signature required" },
            { status: 401, headers: jsonHeaders(requestId) }
          );
        }
        const response = await handleCustomConnectorApi(request, env, userId);
        return withMeta(response, requestId);
      }

      // Dynamic custom MCP proxy
      const customMcpMatch = pathname.match(/^\/mcp\/custom\/([a-zA-Z0-9_-]+)$/);
      if (customMcpMatch) {
        const userId = await requireInternalUser(request, env);
        if (!userId) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401, headers: jsonHeaders(requestId) }
          );
        }
        const response = await proxyCustomMcp(request, env, userId, customMcpMatch[1]);
        return withMeta(response, requestId);
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
        return withMeta(response, requestId);
      }

      if (pathname === "/oauth/authorize") {
        try {
          const response = await handleMcpAuthorize(request, env);
          return withMeta(response, requestId);
        } catch {
          return oauthServerError(requestId, "OAuth authorization is temporarily unavailable");
        }
      }

      if (pathname === "/oauth/token") {
        try {
          const response = await handleMcpToken(request, env);
          return withMeta(response, requestId);
        } catch {
          return oauthServerError(requestId, "OAuth token service is temporarily unavailable");
        }
      }

      const customOAuthResponse = await handleCustomOAuth(request, env, pathname);
      if (customOAuthResponse) return withMeta(customOAuthResponse, requestId);

      const metadataMatch = pathname.match(
        /^\/\.well-known\/oauth-protected-resource\/mcp\/([a-zA-Z0-9_-]+)$/
      );
      if (metadataMatch && request.method === "GET") {
        if (!publicConnectorList().some((item) => item.id === metadataMatch[1])) {
          return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
        }
        const response = oauthProtectedResourceMetadata(request, metadataMatch[1]);
        return withMeta(response, requestId);
      }

      const tokenSync = pathname.match(/^\/internal\/mcp-token\/([a-zA-Z0-9_-]+)$/);
      if (tokenSync) {
        const response = await handleMcpTokenSync(request, env);
        return withMeta(response, requestId);
      }

      const oauthResponse = await handleOAuth(request, env, pathname);
      if (oauthResponse) return withMeta(oauthResponse, requestId);

      const realMcpMatch = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
      if (realMcpMatch) {
        // avoid capturing "custom" as a catalog provider
        if (realMcpMatch[1] === "custom") {
          return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
        }
        const response = await handleRealMcp(request, env, realMcpMatch[1]);
        return withMeta(response, requestId);
      }

      const toolsMatch = pathname.match(/^\/gateway\/([a-zA-Z0-9_-]+)\/tools$/);
      if (toolsMatch && request.method === "POST") {
        const response = await mcpToolsList(request, env, toolsMatch[1]);
        return withMeta(response, requestId);
      }

      const callMatch = pathname.match(/^\/gateway\/([a-zA-Z0-9_-]+)\/call$/);
      if (callMatch && request.method === "POST") {
        const response = await mcpToolCall(request, env, callMatch[1]);
        return withMeta(response, requestId);
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
