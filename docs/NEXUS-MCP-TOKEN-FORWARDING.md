# NEXUS MCP token-forwarding contract

This gateway is designed to sit behind the real NEXUS AI backend. The backend authenticates to this Worker with the existing `X-Nexus-User-Id` + HMAC signature contract.

## Request path

```text
NEXUS AI backend
  -> signed request
nexus-mcp-server
  -> per-user encrypted MCP token in TOKENS_KV
official remote MCP server
  -> tools/list / tools/call
```

## Upstream OAuth providers

For providers marked `upstream-oauth`, this gateway does **not** exchange a generic provider API OAuth token for an MCP token. The official provider MCP OAuth flow must produce the MCP access token first.

Once the real NEXUS backend has that provider-issued MCP token, it syncs it to:

```text
POST /internal/mcp-token/<provider>
X-Nexus-User-Id: <stable-user-id>
X-Nexus-Signature: HMAC-SHA256(NEXUS_INTERNAL_AUTH_SECRET, user-id)
Content-Type: application/json
```

Body:

```json
{
  "access_token": "<provider-issued-mcp-access-token>",
  "refresh_token": "<provider-issued-mcp-refresh-token>",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "<provider-issued-scope>"
}
```

The gateway never returns the token. It stores the record encrypted with AES-GCM and associates it with the signed NEXUS user ID.

To revoke the stored credential for that user:

```text
DELETE /internal/mcp-token/<provider>
```

The same internal authentication is mandatory.

## Atlassian Rovo MCP

Atlassian's current Rovo MCP uses OAuth 2.1 as the recommended interactive authentication method. The current MCP OAuth/DCR test endpoint is:

```text
https://mcp.atlassian.com/v1/mcp/authv2
```

Do **not** use a normal Atlassian 3LO/API OAuth access token as the MCP bearer token. The NEXUS backend/client must complete Atlassian's official MCP OAuth 2.1 flow (including PKCE/DCR as required by Atlassian), obtain the provider-issued MCP access token, and then sync that token through the trusted endpoint above for the correct NEXUS user.

After sync, the gateway forwards that per-user MCP token to the Atlassian MCP server.

## MCP proxy

The backend then calls:

```text
POST /mcp/<provider>
X-Nexus-User-Id: <stable-user-id>
X-Nexus-Signature: HMAC-SHA256(NEXUS_INTERNAL_AUTH_SECRET, user-id)
```

The gateway loads the user's stored token, refreshes it when the provider is a gateway-managed OAuth provider, and forwards it as the upstream `Authorization: Bearer ...` header.

The gateway strips incoming authorization and internal headers before forwarding, so a caller cannot smuggle a different credential to the upstream MCP service.

## Cloudflare

Cloudflare remains a gateway-managed OAuth connector in this repository because the current NEXUS Cloudflare OAuth client has already been registered and tested successfully. Its OAuth tokens are now encrypted at rest too.

Do not replace the Cloudflare MCP OAuth token with a generic Cloudflare API token. They are different credential types.

## Production secret

Set a separate random `NEXUS_TOKEN_ENCRYPTION_SECRET` in production. The Worker falls back to `NEXUS_INTERNAL_AUTH_SECRET` only for deployments that have not yet configured the dedicated encryption secret.
