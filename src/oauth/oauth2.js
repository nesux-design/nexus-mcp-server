import { CONNECTORS } from "../../config/connectors.js";

const PROVIDER_CONFIG = {
  cloudflare: { authorize: "https://dash.cloudflare.com/oauth2/auth", token: "https://dash.cloudflare.com/oauth2/token" },
  vercel: { authorize: "https://vercel.com/oauth/authorize", token: "https://api.vercel.com/v2/oauth/access_token" },
  netlify: { authorize: "https://app.netlify.com/authorize", token: "https://api.netlify.com/oauth/token" },
  sentry: { authorize: "https://sentry.io/oauth/authorize/", token: "https://sentry.io/oauth/token/" },
  atlassian: { authorize: "https://auth.atlassian.com/authorize", token: "https://auth.atlassian.com/oauth/token" },
  google: { authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token" },
  airtable: { authorize: "https://airtable.com/oauth2/v1/authorize", token: "https://airtable.com/oauth2/v1/token" }
};

function cfg(provider, env) {
  const connector = CONNECTORS[provider];
  const oauth = PROVIDER_CONFIG[provider];
  if (!connector || connector.auth !== "oauth2" || !oauth) throw new Error(`Unsupported OAuth provider: ${provider}`);
  const clientId = env[connector.env.clientId];
  const clientSecret = env[connector.env.clientSecret];
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth credentials are not configured`);
  return { connector, oauth, clientId, clientSecret };
}

export function authorizationUrl(request, env, provider, state, codeChallenge) {
  const { connector, oauth, clientId } = cfg(provider, env);
  const url = new URL(oauth.authorize);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", new URL(connector.callback, request.url).toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);

  if (connector.pkce && codeChallenge) {
    url.searchParams.set("code_challenge", codeChallenge);
    url.searchParams.set("code_challenge_method", "S256");
  }

  if (connector.scopes?.length) {
    url.searchParams.set("scope", connector.scopes.join(" "));
    // Cloudflare's authorization endpoint expects the OAuth scope value to use
    // percent-encoded spaces. URLSearchParams normally serializes spaces as
    // `+`, which Cloudflare can treat as a literal plus in this endpoint.
    url.search = url.search.replace(/([?&]scope=)([^&]*)/, (_, prefix, value) => {
      return `${prefix}${value.replace(/\+/g, "%20")}`;
    });
  }

  if (provider === "atlassian") {
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("prompt", "consent");
  }
  return url;
}

async function tokenRequest(oauth, body, auth) {
  const headers = { "content-type": "application/x-www-form-urlencoded", accept: "application/json" };
  if (auth?.method === "client_secret_basic") {
    if (!auth.clientId || !auth.clientSecret) throw new Error("OAuth client credentials are required for client_secret_basic");
    headers.authorization = `Basic ${btoa(`${auth.clientId}:${auth.clientSecret}`)}`;
  }

  const response = await fetch(oauth.token, {
    method: "POST",
    headers,
    body
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`OAuth token request failed (${response.status}): ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

export async function exchangeCode(request, env, provider, code, codeVerifier) {
  const { connector, oauth, clientId, clientSecret } = cfg(provider, env);
  const redirectUri = new URL(connector.callback, request.url).toString();
  const authMethod = connector.tokenEndpointAuthMethod || "client_secret_post";
  const params = {
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    redirect_uri: redirectUri
  };
  if (authMethod === "client_secret_post") params.client_secret = clientSecret;
  if (connector.pkce && codeVerifier) params.code_verifier = codeVerifier;
  return tokenRequest(oauth, new URLSearchParams(params), {
    method: authMethod,
    clientId,
    clientSecret
  });
}

export async function refreshAccessToken(env, provider, refreshToken) {
  if (!refreshToken) throw new Error(`${provider} does not have a refresh token`);
  const { connector, oauth, clientId, clientSecret } = cfg(provider, env);
  const authMethod = connector.tokenEndpointAuthMethod || "client_secret_post";
  const params = {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  };
  if (authMethod === "client_secret_post") params.client_secret = clientSecret;
  return tokenRequest(oauth, new URLSearchParams(params), {
    method: authMethod,
    clientId,
    clientSecret
  });
}

export function isOAuthProvider(provider) {
  return Boolean(PROVIDER_CONFIG[provider] && CONNECTORS[provider]?.auth === "oauth2");
}
