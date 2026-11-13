#!/usr/bin/env python3
# routes + custom string replace

from pathlib import Path
p=Path("src/oauth/routes.js"); t=p.read_text(); old='    if (!tokens?.access_token) throw new Error("OAuth token response did not include access_token");\n\n    const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;\n    await saveTokens(env, provider, tokens, stateRecord.userId, encryptionSecret);'; new='    if (!tokens?.access_token) throw new Error("OAuth token response did not include access_token");\n\n    const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;\n    // Persist client + token_endpoint so silent refresh works for upstream MCP OAuth (all native providers)\n    const tokenRecord = {\n      ...tokens,\n      client_id: stateRecord.clientId || tokens.client_id || null,\n      client_secret: stateRecord.clientSecret || tokens.client_secret || null,\n      token_endpoint: (stateRecord.discovery && stateRecord.discovery.tokenEndpoint) || tokens.token_endpoint || null,\n      token_endpoint_auth_method: stateRecord.tokenEndpointAuthMethod || "none",\n      resource: (stateRecord.discovery && stateRecord.discovery.resource) || null,\n    };\n    await saveTokens(env, provider, tokenRecord, stateRecord.userId, encryptionSecret);'
if old in t: p.write_text(t.replace(old,new,1)); print("routes ok")
elif "token_endpoint:" in t and "stateRecord.discovery" in t: print("routes already")
else: raise SystemExit("routes fail")
p=Path("src/mcp/custom-oauth.js"); t=p.read_text(); old='await saveTokens(env, `custom:${connectorId}`, tokens, state.userId, secret);'; new='await saveTokens(env, `custom:${connectorId}`, {\n      ...tokens,\n      client_id: state.client && state.client.clientId,\n      client_secret: state.client && state.client.clientSecret,\n      token_endpoint: connectorForUser.tokenEndpoint,\n      token_endpoint_auth_method: (state.client && state.client.authMethod) || "none",\n      resource: connectorForUser.url,\n    }, state.userId, secret);'
if old in t: p.write_text(t.replace(old,new,1)); print("custom ok")
elif "connectorForUser.tokenEndpoint" in t: print("custom already")
else: raise SystemExit("custom fail")
print("done")
