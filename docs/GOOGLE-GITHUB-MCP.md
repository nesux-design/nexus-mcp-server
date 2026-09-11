# Google + GitHub real MCP (nexus-mcp-server)

These connectors are **official remote MCPs** — not local API wrappers.

| Connector | Official MCP URL | Path on this gateway |
|-----------|------------------|----------------------|
| **GitHub** | `https://api.githubcopilot.com/mcp/` | `/mcp/github` |
| **Google Drive** | `https://drivemcp.googleapis.com/mcp/v1` | `/mcp/googleDrive` |
| **Gmail** | `https://gmailmcp.googleapis.com/mcp/v1` | `/mcp/gmail` |

## Behaviour

Same as Cloudflare / Vercel / Netlify:

1. NEXUS backend calls gateway with `X-Nexus-User-Id` + HMAC signature
2. Gateway **transparently proxies** to the official MCP (no fake tools)
3. Upstream returns real OAuth challenge (`WWW-Authenticate` + resource_metadata)
4. Client completes provider consent (GitHub / Google)

## nexus-a1

Local Google/GitHub OAuth + plugin handlers in `nexus-a1` are **deprecated**.
Connect flows should use these MCP endpoints instead of `/oauth/google/login` or `/oauth/github/login`.

## Test

```bash
curl -i -X POST "https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/github" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Nexus-User-Id: $USER_ID" \
  -H "X-Nexus-Signature: $SIGNATURE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Same for `/mcp/gmail` and `/mcp/googleDrive`.
