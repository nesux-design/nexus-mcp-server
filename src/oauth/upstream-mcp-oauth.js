const encoder = new TextEncoder();

export const ATLASSIAN_RESOURCE = "https://mcp.atlassian.com/v1/mcp/authv2";
export const ATLASSIAN_PROTECTED_RESOURCE_METADATA =
  "https://mcp.atlassian.com/.well-known/oauth-protected-resource/v1/mcp/authv2";

function base64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function createPkceVerifier() {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function createPkceChallenge(verifier) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(verifier));
  return base64Url(new Uint8Array(digest));
}

function authorizationServerMetadataUrl(authorizationServer) {
  const url = new URL(authorizationServer);
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.origin}/.well-known/oauth-authorization-server${path}`;
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : {}; } catch { body = { raw: text }; }
  if (!response.ok) {
    throw new Error(`Upstream OAuth request failed (${response.status}): ${text.slice(0, 500)}`);
  }
  return body;
}

export async function discoverAtlassianOAuth() {
  const protectedResource = await jsonFetch(ATLASSIAN_PROTECTED_RESOURCE_METADATA);
  const resource = protectedResource.resource || ATLASSIAN_RESOURCE;
  if (resource !== ATLASSIAN_RESOURCE) {
    throw new Error("Atlassian protected-resource metadata returned an unexpected resource");
  }

  const authorizationServer = protectedResource.authorization_servers?.[0];
  if (typeof authorizationServer !== "string" || !authorizationServer) {
    throw new Error("Atlassian OAuth authorization server was not advertised");
  }

  const metadata = await jsonFetch(authorizationServerMetadataUrl(authorizationServer));
  if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new Error("Atlassian OAuth server metadata is missing authorization or token endpoint");
  }

  if (!metadata.registration_endpoint) {
    throw new Error("Atlassian OAuth server does not expose dynamic client registration");
  }

  return {
    resource,
    authorizationServer,
    authorizationEndpoint: metadata.authorization_endpoint,
    tokenEndpoint: metadata.token_endpoint,
    registrationEndpoint: metadata.registration_endpoint,
    scopes: Array.isArray(metadata.scopes_supported) ? metadata.scopes_supported : []
  };
}

export async function registerAtlassianClient(discovery, redirectUri) {
  const body = {
    client_name: "NEXUS Atlassian MCP",
    redirect_uris: [redirectUri],
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none"
  };

  const registration = await jsonFetch(discovery.registrationEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });

  if (!registration.client_id) throw new Error("Atlassian DCR response did not include client_id");
  return {
    clientId: registration.client_id,
    clientSecret: registration.client_secret || null,
    tokenEndpointAuthMethod: registration.token_endpoint_auth_method || "none"
  };
}

export async function buildAtlassianAuthorizationUrl({ discovery, clientId, redirectUri, state, codeChallenge }) {
  const url = new URL(discovery.authorizationEndpoint);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("resource", discovery.resource);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  if (discovery.scopes.length) {
    url.searchParams.set("scope", discovery.scopes.join(" "));
  }

  return url;
}

export async function exchangeAtlassianCode({ discovery, clientId, clientSecret, tokenEndpointAuthMethod, code, verifier, redirectUri }) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri,
    code_verifier: verifier,
    resource: discovery.resource
  });

  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json"
  };

  if (tokenEndpointAuthMethod === "client_secret_basic") {
    if (!clientSecret) throw new Error("Atlassian DCR requires a client secret but none was returned");
    headers.authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else if (clientSecret && tokenEndpointAuthMethod === "client_secret_post") {
    params.set("client_secret", clientSecret);
  }

  return jsonFetch(discovery.tokenEndpoint, {
    method: "POST",
    headers,
    body: params
  });
}
