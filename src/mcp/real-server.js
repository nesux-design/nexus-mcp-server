import { createMcpHandler, fromJsonSchema, McpServer } from "@modelcontextprotocol/server";
import { CONNECTORS } from "../../config/connectors.js";
import { proxyRemoteMcp } from "./proxy.js";
import { authenticateMcpRequest } from "./oauth-resource-auth.js";
import { requireInternalUser } from "../security/internal-auth.js";

// No local MCP wrappers — all connectors use official remote MCP or api-key proxy
const LOCAL_MCP_SERVERS = {};

function textResult(value) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

async function validateOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try { if (origin === new URL(request.url).origin) return null; } catch { }
  return new Response("Forbidden", { status: 403, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

async function resolveUser(request, env, provider) {
  const internalUserId = await requireInternalUser(request, env);
  if (internalUserId) return { userId: internalUserId };

  const auth = await authenticateMcpRequest(request, env, provider);
  if (auth.response) return { response: auth.response };
  return { userId: auth.userId };
}

export async function handleRealMcp(request, env, provider) {
  const connector = CONNECTORS[provider];
  if (!connector?.mcp) return new Response("MCP provider not found", { status: 404 });

  const originRejection = await validateOrigin(request);
  if (originRejection) return originRejection;

  const auth = await resolveUser(request, env, provider);
  if (auth.response) return auth.response;
  const userId = auth.userId;

  if (connector.mcpUrl) {
    return await proxyRemoteMcp(request, env, provider, userId);
  }

  return new Response("MCP provider is not configured", { status: 404 });
}

export { LOCAL_MCP_SERVERS };
