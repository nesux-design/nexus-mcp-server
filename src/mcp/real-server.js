import { CONNECTORS } from "../../config/connectors.js";
import { proxyRemoteMcp } from "./proxy.js";
import { proxyBridgeMcp } from "./bridge-proxy.js";
import { handleLocalMcp } from "./local-mcp.js";
import { authenticateMcpRequest } from "./oauth-resource-auth.js";
import { requireInternalUser } from "../security/internal-auth.js";

const LOCAL_MCP_SERVERS = {};

async function validateOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    if (origin === new URL(request.url).origin) return null;
  } catch {}
  return new Response("Forbidden", {
    status: 403,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" }
  });
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

  // Bridge (Telegram Render) — still require NEXUS user for gateway entry
  if (connector.auth === "bridge") {
    const auth = await resolveUser(request, env, provider);
    if (auth.response) return auth.response;
    return await proxyBridgeMcp(request, env, provider);
  }

  // Local custom MCP (Discord, Reddit, …)
  if (connector.local) {
    const auth = await resolveUser(request, env, provider);
    if (auth.response) return auth.response;
    return await handleLocalMcp(request, env, provider, auth.userId);
  }

  // Official remote MCP URL
  if (connector.mcpUrl) {
    const auth = await resolveUser(request, env, provider);
    if (auth.response) return auth.response;
    return await proxyRemoteMcp(request, env, provider, auth.userId);
  }

  return new Response("MCP provider is not configured", { status: 404 });
}

export { LOCAL_MCP_SERVERS };
