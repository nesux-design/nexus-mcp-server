#!/usr/bin/env python3
"""Surgical wire of token-refresh.js into proxy.js + upstream refreshUpstreamToken."""
from pathlib import Path
import re

pr = Path("src/mcp/proxy.js")
pt = pr.read_text()
if "token-refresh.js" in pt and "forceRefresh" in pt:
    print("proxy already wired")
else:
    old_imp = (
        'import { CONNECTORS } from "../../config/connectors.js";\n'
        'import { loadTokens, saveTokens } from "../oauth/store.js";\n'
        'import { refreshAccessToken, isOAuthProvider } from "../oauth/oauth2.js";\n'
        'import { requireInternalUser } from "../security/internal-auth.js";'
    )
    new_imp = (
        'export { getOAuthAccessToken } from "../oauth/token-refresh.js";\n'
        'import { CONNECTORS } from "../../config/connectors.js";\n'
        'import { loadTokens, saveTokens } from "../oauth/store.js";\n'
        'import { requireInternalUser } from "../security/internal-auth.js";\n'
        'import { getOAuthAccessToken } from "../oauth/token-refresh.js";'
    )
    if old_imp not in pt:
        raise SystemExit("import anchor missing")
    pt = pt.replace(old_imp, new_imp, 1)
    pt2, n = re.subn(
        r"export async function getOAuthAccessToken\(env, provider, userId\) \{.*?\n\}\n\nfunction buildUpstreamHeaders",
        "function buildUpstreamHeaders",
        pt,
        count=1,
        flags=re.S,
    )
    if n != 1:
        raise SystemExit(f"remove getOAuthAccessToken failed n={n}")
    pt = pt2
    old_fetch = (
        '  const accessToken = (connector.auth === "oauth2" || connector.auth === "upstream-oauth")\n'
        '    ? await getOAuthAccessToken(env, provider, userId)\n'
        '    : null;\n\n'
        '  const headers = buildUpstreamHeaders(request, connector, env, provider, accessToken);\n'
        '  if (!headers) return { response: oauthRequired(provider, connector), userId };\n\n'
        '  if (contentType) headers.set("content-type", contentType);\n\n'
        '  const controller = new AbortController();\n'
        '  const timeout = setTimeout(() => controller.abort(), 30_000);\n\n'
        '  try {\n'
        '    const response = await fetch(target.toString(), {\n'
        '      method,\n'
        '      headers,\n'
        '      body: ["GET", "HEAD"].includes(method) ? undefined : body,\n'
        '      signal: controller.signal\n'
        '    });\n'
        '    return {\n'
        '      response: new Response(response.body, {\n'
        '        status: response.status,\n'
        '        statusText: response.statusText,\n'
        '        headers: responseHeaders(response.headers)\n'
        '      }),\n'
        '      userId\n'
        '    };\n'
        '  } catch (error) {\n'
        '    if (error?.name === "AbortError") {\n'
        '      return { response: Response.json({ error: "Upstream MCP request timed out" }, { status: 504 }), userId };\n'
        '    }\n'
        '    return { response: Response.json({ error: "Upstream MCP request failed" }, { status: 502 }), userId };\n'
        '  } finally {\n'
        '    clearTimeout(timeout);\n'
        '  }\n'
        '}'
    )
    new_fetch = (
        '  const needsOauth = connector.auth === "oauth2" || connector.auth === "upstream-oauth";\n'
        '  let accessToken = needsOauth ? await getOAuthAccessToken(env, provider, userId) : null;\n\n'
        '  const headers = buildUpstreamHeaders(request, connector, env, provider, accessToken);\n'
        '  if (!headers) return { response: oauthRequired(provider, connector), userId };\n\n'
        '  if (contentType) headers.set("content-type", contentType);\n\n'
        '  async function doFetch(hdrs) {\n'
        '    const controller = new AbortController();\n'
        '    const timeout = setTimeout(() => controller.abort(), 30_000);\n'
        '    try {\n'
        '      return await fetch(target.toString(), {\n'
        '        method,\n'
        '        headers: hdrs,\n'
        '        body: ["GET", "HEAD"].includes(method) ? undefined : body,\n'
        '        signal: controller.signal\n'
        '      });\n'
        '    } finally {\n'
        '      clearTimeout(timeout);\n'
        '    }\n'
        '  }\n\n'
        '  try {\n'
        '    let response = await doFetch(headers);\n'
        '    if (needsOauth && response.status === 401) {\n'
        '      const renewed = await getOAuthAccessToken(env, provider, userId, { forceRefresh: true });\n'
        '      if (renewed && renewed !== accessToken) {\n'
        '        const hdrs2 = buildUpstreamHeaders(request, connector, env, provider, renewed);\n'
        '        if (hdrs2) {\n'
        '          if (contentType) hdrs2.set("content-type", contentType);\n'
        '          response = await doFetch(hdrs2);\n'
        '        }\n'
        '      } else if (!renewed) {\n'
        '        return { response: oauthRequired(provider, connector), userId };\n'
        '      }\n'
        '    }\n'
        '    return {\n'
        '      response: new Response(response.body, {\n'
        '        status: response.status,\n'
        '        statusText: response.statusText,\n'
        '        headers: responseHeaders(response.headers)\n'
        '      }),\n'
        '      userId\n'
        '    };\n'
        '  } catch (error) {\n'
        '    if (error?.name === "AbortError") {\n'
        '      return { response: Response.json({ error: "Upstream MCP request timed out" }, { status: 504 }), userId };\n'
        '    }\n'
        '    return { response: Response.json({ error: "Upstream MCP request failed" }, { status: 502 }), userId };\n'
        '  }\n'
        '}'
    )
    if old_fetch not in pt:
        raise SystemExit("fetch anchor missing")
    pt = pt.replace(old_fetch, new_fetch, 1)
    pr.write_text(pt)
    print("proxy wired")

up = Path("src/oauth/upstream-mcp-oauth.js")
ut = up.read_text()
if "refreshUpstreamToken" in ut:
    print("upstream already")
else:
    block = '''
async function refreshUpstreamToken({
  tokenEndpoint,
  clientId,
  clientSecret,
  tokenEndpointAuthMethod = "none",
  refreshToken,
  resource,
}) {
  if (!tokenEndpoint) throw new Error("Upstream token endpoint is required for refresh");
  if (!refreshToken) throw new Error("refresh_token is required");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  if (clientId) params.set("client_id", clientId);
  if (resource) params.set("resource", resource);
  const headers = {
    "content-type": "application/x-www-form-urlencoded",
    accept: "application/json",
  };
  if (tokenEndpointAuthMethod === "client_secret_basic") {
    if (!clientSecret) throw new Error("client_secret required for client_secret_basic refresh");
    headers.authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
  } else if (clientSecret && (tokenEndpointAuthMethod === "client_secret_post" || tokenEndpointAuthMethod === "none")) {
    params.set("client_secret", clientSecret);
  }
  return jsonFetch(tokenEndpoint, {
    method: "POST",
    headers,
    body: params,
  });
}

'''
    if "export {\n  createPkceVerifier," not in ut:
        raise SystemExit("upstream export anchor missing")
    ut = ut.replace("export {\n  createPkceVerifier,", block + "export {\n  createPkceVerifier,")
    ut = ut.replace(
        "  exchangeUpstreamCode,\n  normalizeResource,\n};",
        "  exchangeUpstreamCode,\n  refreshUpstreamToken,\n  normalizeResource,\n};",
    )
    up.write_text(ut)
    print("upstream ok")
print("done")
