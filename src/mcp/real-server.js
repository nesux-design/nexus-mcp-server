import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { CONNECTORS } from "../../config/connectors.js";
import { proxyRemoteMcp } from "./proxy.js";
import { authenticateMcpRequest } from "./oauth-resource-auth.js";
import { CloudflareMcpServer } from "./cloudflare-mcp.js";
import { VercelMcpServer } from "./vercel-mcp.js";
import { NetlifyMcpServer } from "./netlify-mcp.js";
import { AtlassianMcpServer } from "./atlassian-mcp.js";
import { SentryMcpServer } from "./sentry-mcp.js";
import { GoogleMcpServer } from "./google-mcp.js";
import { AirtableMcpServer } from "./airtable-mcp.js";

const LOCAL_MCP_SERVERS = {
  cloudflare: CloudflareMcpServer,
  vercel: VercelMcpServer,
  netlify: NetlifyMcpServer,
  atlassian: AtlassianMcpServer,
  sentry: SentryMcpServer,
  google: GoogleMcpServer,
  airtable: AirtableMcpServer
};

function textResult(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function registerLocalTools(server, ServerClass, env, userId) {
  const provider = new ServerClass(env);
  for (const definition of provider.getToolDefinitions()) {
    const inputSchema = definition.inputSchema || { type: "object", properties: {}, required: [] };
    server.registerTool(definition.name, {
      title: definition.title || definition.name,
      description: definition.description || `NEXUS ${definition.name} tool`,
      inputSchema: fromJsonSchema(inputSchema)
    }, async (args) => {
      const result = await provider.handleToolCall(definition.name, args || {}, userId);
      const failed = result && typeof result === "object" && Boolean(result.error);
      return { content: [{ type: "text", text: textResult(result) }], ...(failed ? { isError: true } : {}) };
    });
  }
}

function buildLocalMcpServer(provider, env, userId) {
  const ServerClass = LOCAL_MCP_SERVERS[provider];
  if (!ServerClass) return null;
  return new McpServer({ name: `nexus-${provider}-mcp`, version: "0.7.0" }, {
    capabilities: { tools: {} },
    instructions: `NEXUS remote MCP connector for ${CONNECTORS[provider]?.name || provider}. Tools operate only on the authenticated user's connected provider account.`
  });
}

function buildAndRegisterLocalMcpServer(provider, env, userId) {
  const server = buildLocalMcpServer(provider, env, userId);
  if (server) registerLocalTools(server, LOCAL_MCP_SERVERS[provider], env, userId);
  return server;
}

async function validateOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try { if (origin === new URL(request.url).origin) return null; } catch { }
  return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export async function handleRealMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcp) return new Response("MCP provider not found", { status: 404 });
  const originRejection = await validateOrigin(request);
  if (originRejection) return originRejection;

  const auth = await authenticateMcpRequest(request, env, provider);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  if (LOCAL_MCP_SERVERS[provider]) {
    const handler = createMcpHandler(() => buildAndRegisterLocalMcpServer(provider, env, userId), {
      legacy: "stateless",
      onerror: (error) => console.error(`MCP ${provider} error:`, error)
    });
    return await handler.fetch(request);
  }

  if (connector.mcpUrl) return await proxyRemoteMcp(request, env, provider, userId);
  return new Response("MCP provider is not configured", { status: 404 });
}

export { LOCAL_MCP_SERVERS };
