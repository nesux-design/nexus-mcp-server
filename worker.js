import { publicConnectorList } from "./config/connectors.js";
import { proxyRemoteMcp } from "./src/mcp/proxy.js";
import { handleOAuth } from "./src/oauth/routes.js";

const VERSION = "0.4.0";

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

      const match = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
      if (match) {
        const response = await proxyRemoteMcp(request, env, match[1]);
        response.headers.set("x-request-id", requestId);
        return response;
      }

      return new Response("Not Found", { status: 404, headers: baseHeaders(requestId) });
    } catch (err) {
      return Response.json(
        { error: "Internal server error", requestId, debugMessage: err.message },
        { status: 500, headers: baseHeaders(requestId) }
      );
    }
  }
};
