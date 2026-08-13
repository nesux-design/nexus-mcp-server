import { publicConnectorList } from "./config/connectors.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (pathname === "/") {
      return new Response("Nexus MCP Server is running ✅", { status: 200 });
    }

    // Safe discovery endpoint. It exposes connector metadata only;
    // credentials and tokens are never returned.
    if (pathname === "/connectors" && request.method === "GET") {
      return Response.json({
        server: "nexus-mcp-server",
        connectors: publicConnectorList()
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
