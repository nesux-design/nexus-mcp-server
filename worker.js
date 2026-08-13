import { publicConnectorList } from "./config/connectors.js";
import { proxyRemoteMcp } from "./src/mcp/proxy.js";
import { handleOAuth } from "./src/oauth/routes.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/") {
      return Response.json({ server: "nexus-mcp-server", status: "ok", version: "0.2.0" });
    }

    if (pathname === "/connectors" && request.method === "GET") {
      return Response.json({ server: "nexus-mcp-server", connectors: publicConnectorList() });
    }

    const oauthResponse = await handleOAuth(request, env, pathname);
    if (oauthResponse) return oauthResponse;

    const match = pathname.match(/^\/mcp\/([a-zA-Z0-9_-]+)$/);
    if (match) return proxyRemoteMcp(request, env, match[1]);

    return new Response("Not Found", { status: 404 });
  }
};
