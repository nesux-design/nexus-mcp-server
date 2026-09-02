import { publicConnectorList } from "../../config/connectors.js";

function noStoreHeaders() {
  return {
    "cache-control": "no-store",
    "pragma": "no-cache",
    "content-type": "application/json",
    "x-content-type-options": "nosniff"
  };
}

export function oauthAuthorizationServerMetadata(request) {
  const origin = new URL(request.url).origin;
  const scopes = ["mcp", ...publicConnectorList().flatMap((connector) => connector.scopes || [])];
  return Response.json(
    {
      issuer: `${origin}/oauth`,
      authorization_endpoint: `${origin}/oauth/authorize`,
      token_endpoint: `${origin}/oauth/token`,
      registration_endpoint: `${origin}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      token_endpoint_auth_methods_supported: ["none"],
      code_challenge_methods_supported: ["S256"],
      scopes_supported: [...new Set(scopes)]
    },
    { status: 200, headers: noStoreHeaders() }
  );
}
