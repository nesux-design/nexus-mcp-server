import { publicConnectorList } from "./config/connectors.js";
import { proxyRemoteMcp } from "./src/mcp/proxy.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/") {
      return Response.json({
        server: "nexus-mcp-server",
        status: "ok",
        version: "0.1.0"
      });
    }

    if (pathname === "/connectors" && request.method === "GET") {
      return Response.json({
        server: "nexus-mcp-server",
        connectors: publicConnectorList()
      });
    }

    // Remote MCP gateway routes. Example:
    // POST /mcp/airtable
    // POST /mcp/supabase?read_only=true
    const match = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
    if (match) {
      return proxyRemoteMcp(request, env, match[1]);
    }

    // OAuth callbacks are reserved for the provider-specific implementations.
    // Returning an explicit response avoids pretending an unimplemented flow works.
    const oauthMatch = pathname.match(/^\/oauth\/([a-zA-Z0-9_-]+)(?:\/.*)?$/);
    if (oauthMatch) {
      return Response.json({
        error: "oauth_provider_not_implemented",
        provider: oauthMatch[1],
        message: "Provider OAuth flow is registered but has not been wired yet."
      }, { status: 501 });
    }

    return new Response("Not Found", { status: 404 });
  }
};
