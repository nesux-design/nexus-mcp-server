import { CONNECTORS } from "../../config/connectors.js";
import { loadAccessToken } from "./oauth-code-store.js";
import { oauthUnauthorizedResponse } from "./oauth-resource.js";

function scopesFor(provider) {
  return new Set(CONNECTORS[provider]?.scopes || []);
}

function hasRequiredScope(record, provider) {
  const granted = new Set(String(record.scope || "").split(/\s+/).filter(Boolean));
  if (granted.has("mcp")) return true;
  const allowed = scopesFor(provider);
  for (const scope of granted) if (allowed.has(scope)) return true;
  return false;
}

export async function authenticateMcpRequest(request, env, provider) {
  const token = (request.headers.get("authorization") || "").match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) return { response: oauthUnauthorizedResponse(request, provider) };
  if (!env.OAUTH_CODES) return { response: oauthUnauthorizedResponse(request, provider) };

  const record = await loadAccessToken(env, token);
  if (!record || !record.userId) return { response: oauthUnauthorizedResponse(request, provider) };

  const resource = new URL(`/mcp/${provider}`, request.url).toString();
  if (record.resource !== resource) return { response: oauthUnauthorizedResponse(request, provider) };
  if (!hasRequiredScope(record, provider)) return { response: oauthUnauthorizedResponse(request, provider) };

  return { userId: record.userId, tokenRecord: record };
}
