/**
 * Universal MCP OAuth token lifecycle for ALL native providers:
 * - oauth2 (Google, GitHub, Zoom, …) via oauth2.refreshAccessToken
 * - upstream-oauth (Cloudflare, Netlify, Notion, Linear, …) via refreshUpstreamToken
 * Silent refresh + optional forceRefresh after upstream 401.
 */
import { CONNECTORS } from "../../config/connectors.js";
import { loadTokens, saveTokens } from "./store.js";
import { refreshAccessToken, isOAuthProvider } from "./oauth2.js";
import { refreshUpstreamToken, discoverUpstreamOAuth } from "./upstream-mcp-oauth.js";

const TOKEN_REFRESH_SKEW_MS = 60_000;

export async function refreshProviderTokens(env, provider, record) {
  if (!record?.refresh_token) throw new Error("No refresh_token stored for " + provider);
  if (isOAuthProvider(provider)) {
    return refreshAccessToken(env, provider, record.refresh_token);
  }
  let tokenEndpoint = record.token_endpoint || record.tokenEndpoint || null;
  let resource = record.resource || null;
  if (!tokenEndpoint) {
    const connector = CONNECTORS[provider];
    if (connector?.mcpUrl) {
      try {
        const discovery = await discoverUpstreamOAuth(connector.mcpUrl);
        tokenEndpoint = discovery.tokenEndpoint;
        resource = resource || discovery.resource;
      } catch (e) {
        console.error("discoverUpstreamOAuth for refresh", provider, e && e.message);
      }
    }
  }
  if (!tokenEndpoint) throw new Error("No token_endpoint stored for upstream provider " + provider);
  return refreshUpstreamToken({
    tokenEndpoint,
    clientId: record.client_id || record.clientId || null,
    clientSecret: record.client_secret || record.clientSecret || null,
    tokenEndpointAuthMethod: record.token_endpoint_auth_method || record.tokenEndpointAuthMethod || "none",
    refreshToken: record.refresh_token,
    resource,
  });
}

/** Universal access token with silent refresh for every native MCP OAuth provider. */
export async function getOAuthAccessToken(env, provider, userId, { forceRefresh = false } = {}) {
  const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
  const record = await loadTokens(env, provider, userId, encryptionSecret);
  if (!record?.access_token) return null;
  const expiresAt = Number(record.expires_at || 0);
  const fresh = expiresAt > Date.now() + TOKEN_REFRESH_SKEW_MS;
  if (!forceRefresh && (!expiresAt || fresh)) return record.access_token;
  if (!record.refresh_token) {
    if (expiresAt && expiresAt <= Date.now()) return null;
    return forceRefresh ? null : record.access_token;
  }
  try {
    const refreshed = await refreshProviderTokens(env, provider, record);
    if (!refreshed?.access_token) throw new Error("Refresh response missing access_token");
    const merged = {
      ...record,
      ...refreshed,
      refresh_token: refreshed.refresh_token || record.refresh_token,
      client_id: record.client_id || record.clientId,
      client_secret: record.client_secret || record.clientSecret,
      token_endpoint: record.token_endpoint || record.tokenEndpoint,
      token_endpoint_auth_method: record.token_endpoint_auth_method || record.tokenEndpointAuthMethod || "none",
      resource: record.resource || refreshed.resource || null,
    };
    await saveTokens(env, provider, merged, userId, encryptionSecret);
    return merged.access_token;
  } catch (err) {
    console.error("OAuth refresh failed", provider, err && err.message);
    if (expiresAt && expiresAt <= Date.now()) return null;
    if (forceRefresh) return null;
    return record.access_token;
  }
}
