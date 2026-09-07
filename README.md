# nexus-mcp-server

Production Cloudflare Worker gateway between the real NEXUS AI backend and **official remote MCP services**.

This worker deliberately stays small and owns the connector boundary: gateway authentication, per-user token storage where needed, and Streamable HTTP proxying to real upstream MCP servers.

## Real MCP connectors (ekdam real)

Whenever a provider has an official remote MCP endpoint, this gateway **always** proxies to it.  
Users see the **real provider consent page** (Read only / Full access / Custom) — exactly like Kimi AI, Claude, and Cursor.

| Connector | Official MCP endpoint | Consent experience |
|-----------|-----------------------|--------------------|
| **Cloudflare** | `https://mcp.cloudflare.com/mcp` | Official Cloudflare page (Read only / Full access / Custom) |
| **Vercel** | `https://mcp.vercel.com` | Official Vercel OAuth |
| **Netlify** | `https://netlify-mcp.netlify.app/mcp` | Official Netlify OAuth |
| **Supabase** | `https://mcp.supabase.com/mcp` | Official Supabase OAuth |
| **Atlassian** | `https://mcp.atlassian.com/v1/mcp` | Official Atlassian OAuth |
| **Airtable** | `https://mcp.airtable.com/mcp` | Official Airtable OAuth |
| **Google Developer Knowledge** | `https://developerknowledge.googleapis.com/mcp` | API key (server-side) |

Local wrappers exist **only** as fallback for providers that do not yet publish an official remote MCP (currently Sentry & generic Google).

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

The gateway verifies the signature, loads only that user's provider credential (when needed), strips inbound authorization/cookie/internal headers, and forwards the MCP JSON-RPC request to the official upstream service.

See `docs/NEXUS-AI-MCP-CONTRACT.md` for the integration contract.

## MCP transport

The gateway forwards Streamable HTTP requests and preserves MCP protocol/session headers.  
MCP clients should send `Accept: application/json, text/event-stream` and preserve `Mcp-Session-Id` / `MCP-Protocol-Version` when returned by an upstream server.

## OAuth & Consent

- **upstream-oauth** providers (Cloudflare, Vercel, Netlify, Supabase, Atlassian, Airtable)  
  → The **official provider** owns the full OAuth + consent flow.  
  → User sees the real Read only / Full access / Custom page.

- Gateway-managed OAuth is used only for local fallback connectors.

## Google Developer Knowledge

Proxied at `/mcp/googleDeveloperKnowledge`.

Set the Cloudflare Worker secret:

```text
DEVELOPERKNOWLEDGE_API_KEY
```

The key is injected only server-side as `X-Goog-Api-Key`.

## Production secrets

Never commit:

- OAuth client secrets
- OAuth access/refresh tokens
- Google Developer Knowledge API keys
- `NEXUS_INTERNAL_AUTH_SECRET`

Use Cloudflare Worker secrets/variables and `TOKENS_KV` for runtime credentials.
