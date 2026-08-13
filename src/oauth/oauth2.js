import { CONNECTORS } from "../../config/connectors.js";

const PROVIDER_CONFIG = {
  cloudflare: { authorize: "https://dash.cloudflare.com/oauth2/authorize", token: "https://dash.cloudflare.com/oauth2/token" },
  vercel: { authorize: "https://vercel.com/oauth/authorize", token: "https://api.vercel.com/v2/oauth/access_token" },
  netlify: { authorize: "https://app.netlify.com/authorize", token: "https://api.netlify.com/oauth/tokens" },
  sentry: { authorize: "https://sentry.io/oauth/authorize/", token: "https://sentry.io/oauth/token/" },
  atlassian: { authorize: "https://auth.atlassian.com/authorize", token: "https://auth.atlassian.com/oauth/token" },
  google: { authorize: "https://accounts.google.com/o/oauth2/v2/auth", token: "https://oauth2.googleapis.com/token" }
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

export function authorizationUrl(request, env, provider) {
  const { connector, oauth, clientId } = cfg(provider, env);
  const url = new URL(oauth.authorize);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", new URL(connector.callback, request.url).toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", crypto.randomUUID());
  if (connector.scopes?.length) url.searchParams.set("scope", connector.scopes.join(" "));
  if (provider === "atlassian") {
    url.searchParams.set("audience", "api.atlassian.com");
    url.searchParams.set("prompt", "consent");
  }
  return url;
}

export async function exchangeCode(request, env, provider, code) {
  const { connector, oauth, clientId, clientSecret } = cfg(provider, env);
  const redirectUri = new URL(connector.callback, request.url).toString();
  const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri });
  const response = await fetch(oauth.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  const text = await response.text();
  if (!response.ok) throw new Error(`${provider} token exchange failed (${response.status}): ${text.slice(0, 500)}`);
  return JSON.parse(text);
}
