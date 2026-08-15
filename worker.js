import { publicConnectorList } from "./config/connectors.js";
import { mcpToolCall, mcpToolsList, proxyRemoteMcp } from "./src/mcp/proxy.js";
import { handleMcpTokenSync } from "./src/mcp/token-sync.js";
import { handleOAuth } from "./src/oauth/routes.js";

const VERSION = "0.7.0";

function baseHeaders(requestId) {
  return {
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "no-referrer",
    "x-request-id": requestId
  };
}

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
          { headers: baseHeaders(requestId) }
        );
      }

      if (pathname === "/connectors" && request.method === "GET") {
        return Response.json(
          { server: "nexus-mcp-server", version: VERSION, connectors: publicConnectorList() },
          { headers: baseHeaders(requestId) }
        );
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
        return new Response(oauthResponse.body, {
          status: oauthResponse.status,
          statusText: oauthResponse.statusText,
          headers
        });
      }

      // JSON gateway API for the real Nexus AI backend. The gateway owns the
      // upstream MCP authentication/session and forwards the authorized token
      // only for the authenticated Nexus user. This avoids requiring the main
      // AI Worker to implement every provider's MCP transport itself.
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

      const match = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
      if (match) {
        const response = await proxyRemoteMcp(request, env, match[1]);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
    } catch {
      return Response.json(
        { error: "Internal server error", requestId },
        { status: 500, headers: baseHeaders(requestId) }
      );
    }
  }
};
