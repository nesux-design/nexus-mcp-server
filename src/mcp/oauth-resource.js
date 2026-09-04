import { CONNECTORS } from "../../config/connectors.js";

export const MCP_OAUTH_ISSUER_PATH = "/oauth";

function noStoreHeaders() {
  return {
    "cache-control": "no-store",
    "pragma": "no-cache",
    "content-type": "application/json",
    "x-content-type-options": "nosniff"
  };
}

function resourceUri(request, provider) {
  return new URL(`/mcp/${provider}`, request.url).toString();
}

function issuerUri(request) {
  return new URL(MCP_OAUTH_ISSUER_PATH, request.url).toString().replace(/\/$/, "");
}

export function oauthProtectedResourceMetadata(request, provider) {
  const connector = CONNECTORS[provider];
  const resource = resourceUri(request, provider);
  const issuer = issuerUri(request);
  const connectorScopes = connector?.scopes?.filter((scope) => typeof scope === "string" && scope.length) || [];
  const scopes = ["mcp", ...connectorScopes];

  return Response.json(
    {
      resource,
      authorization_servers: [issuer],
      bearer_methods_supported: ["header"],
      scopes_supported: [...new Set(scopes)]
    },
    { status: 200, headers: noStoreHeaders() }
  );
}

export function oauthUnauthorizedResponse(request, provider, scope = ["mcp"]) {
  const metadataUrl = new URL(`/.well-known/oauth-protected-resource/mcp/${provider}`, request.url).toString();
  const values = Array.isArray(scope) ? scope.filter(Boolean) : [];
  let challenge = `Bearer resource_metadata="${metadataUrl}"`;
  if (values.length) challenge += `, scope="${values.join(" ")}"`;

  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: {
      ...noStoreHeaders(),
      "www-authenticate": challenge
    }
  });
}

export function isBearerTokenRequest(request) {
  const authorization = request.headers.get("authorization") || "";
  return /^Bearer\s+\S+$/i.test(authorization);
}

export function bearerToken(request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}
