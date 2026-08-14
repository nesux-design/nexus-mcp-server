# NEXUS AI ↔ MCP Gateway contract

This worker is the connector gateway for the real NEXUS AI backend. The large NEXUS AI Worker remains the host/orchestrator; this service owns provider OAuth, user-scoped tokens, and Streamable HTTP MCP proxying.

## Request identity

The NEXUS AI backend must send both headers on gateway requests:

- `X-Nexus-User-Id`: the same stable `auth.userId` used by NEXUS AI for the connected user.
- `X-Nexus-Signature`: HMAC-SHA256 of the exact user id using `NEXUS_INTERNAL_AUTH_SECRET`.

The gateway never trusts a user id supplied by the MCP payload. It authenticates the gateway request before loading credentials.

## MCP endpoint

For a real remote MCP connector:

`POST https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/<connector>`

The body is standard MCP JSON-RPC over Streamable HTTP. The gateway forwards the JSON-RPC message to the provider's official MCP endpoint and injects the authenticated user's provider access token server-side.

Clients should send `Accept: application/json, text/event-stream` and preserve MCP session/protocol headers such as `Mcp-Session-Id` and `MCP-Protocol-Version` when the upstream uses them.

## Real upstreams

- Cloudflare API MCP: `https://mcp.cloudflare.com/mcp`
- Vercel MCP: `https://mcp.vercel.com`
- Netlify MCP: `https://netlify-mcp.netlify.app/mcp`
- Atlassian Rovo MCP: `https://mcp.atlassian.com/v1/mcp`
- Google Developer Knowledge MCP: `https://developerknowledge.googleapis.com/mcp`
- Airtable MCP: `https://mcp.airtable.com/mcp`
- Supabase MCP: `https://mcp.supabase.com/mcp`

These URLs are official provider endpoints. This gateway does not implement fake provider tools or emulate provider APIs.

## Important authentication note

Provider OAuth for the gateway is only used where the resulting token is accepted by the provider MCP service. Some official MCP services (notably Vercel) enforce their own MCP client allowlists or MCP-specific OAuth authorization. Those providers must use their supported MCP authorization flow rather than treating an unrelated provider API OAuth token as an MCP token.

## Non-MCP OAuth providers

A provider may still have an OAuth integration in the gateway without being advertised as a remote MCP connector. For example, Sentry currently remains an OAuth provider in this repository, but is not represented as an MCP upstream because an official Sentry remote MCP endpoint has not been verified here.

## Security

- No OAuth client secret, access token, refresh token, PAT, or API key belongs in Git.
- Provider tokens are stored per user in `TOKENS_KV`.
- The gateway strips incoming `Authorization`, cookies, and internal authentication headers before constructing the upstream request.
- Provider credentials are injected only server-side.
- MCP responses are returned without caching.
