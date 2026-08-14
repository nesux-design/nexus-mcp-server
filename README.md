# nexus-mcp-server

Production Cloudflare Worker gateway between the real NEXUS AI backend and official remote MCP services.

The large NEXUS AI Worker remains the host/orchestrator. This worker deliberately stays small and owns the connector boundary: gateway authentication, provider OAuth where appropriate, per-user token storage, and Streamable HTTP proxying.

## Real MCP connectors

Only official remote MCP endpoints are advertised by `GET /connectors`:

| Connector | Official MCP endpoint | Gateway authentication |
|---|---|---|
| Cloudflare | `https://mcp.cloudflare.com/mcp` | NEXUS OAuth token |
| Vercel | `https://mcp.vercel.com` | Provider-owned MCP OAuth |
| Netlify | `https://netlify-mcp.netlify.app/mcp` | Provider-owned MCP OAuth |
| Atlassian Rovo | `https://mcp.atlassian.com/v1/mcp` | NEXUS OAuth token |
| Google Developer Knowledge | `https://developerknowledge.googleapis.com/mcp` | Restricted Google API key |
| Airtable | `https://mcp.airtable.com/mcp` | Worker PAT secret |
| Supabase | `https://mcp.supabase.com/mcp` | Provider-owned MCP OAuth |

These are real upstream MCP servers. The gateway does not fake tool schemas or emulate provider APIs.

## NEXUS AI gateway contract

The main NEXUS AI backend calls:

```text
POST /mcp/<connector>
```

and sends:

```text
X-Nexus-User-Id: <stable NEXUS auth.userId>
X-Nexus-Signature: HMAC-SHA256(NEXUS_INTERNAL_AUTH_SECRET, userId)
```

The gateway verifies the signature, loads only that user's provider credential, strips inbound authorization/cookie/internal headers, and forwards the MCP JSON-RPC request to the official upstream service.

See `docs/NEXUS-AI-MCP-CONTRACT.md` for the integration contract.

## MCP transport

The gateway forwards Streamable HTTP requests and preserves MCP protocol/session headers. MCP clients should send `Accept: application/json, text/event-stream` and preserve `Mcp-Session-Id` / `MCP-Protocol-Version` when returned or negotiated by an upstream server.

## OAuth

Gateway-managed OAuth is currently used for providers whose access tokens are valid credentials for the configured MCP upstream. OAuth state is bound to the authenticated NEXUS user and stored as an encrypted, short-lived state value. Tokens are stored per user in `TOKENS_KV` and refreshed when a provider supplies a refresh token.

Vercel, Netlify, and Supabase are marked `upstream-oauth` because their official MCP services own the MCP authorization flow. The gateway intentionally does **not** substitute a normal provider API OAuth token for an MCP token. This prevents the `invalid_client`/wrong-resource class of failures seen when a generic provider OAuth app is used against an MCP resource server.

Sentry and ordinary Google OAuth remain available as OAuth integrations but are not advertised as MCP connectors because this repository does not claim an official Sentry/Google remote MCP endpoint for them.

## Google Developer Knowledge

The Google Developer Knowledge MCP endpoint is proxied at:

```text
/mcp/googleDeveloperKnowledge
```

Set the Cloudflare Worker secret:

```text
DEVELOPERKNOWLEDGE_API_KEY
```

The key is injected only server-side as `X-Goog-Api-Key`. Restrict the Google key to the Developer Knowledge API and do not commit the key to Git.

## Production secrets

Never commit:

- OAuth client secrets
- OAuth access/refresh tokens
- Airtable PATs
- Google Developer Knowledge API keys
- `NEXUS_INTERNAL_AUTH_SECRET`

Use Cloudflare Worker secrets/variables and `TOKENS_KV` for runtime credentials.
