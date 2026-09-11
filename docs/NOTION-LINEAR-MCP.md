# Notion + Linear official remote MCP

| Connector | Official MCP URL | Gateway path |
|-----------|------------------|--------------|
| **Notion** | `https://mcp.notion.com/mcp` | `/mcp/notion` |
| **Linear** | `https://mcp.linear.app/mcp` | `/mcp/linear` |

Both use transparent proxy (`upstream-oauth`) — same as Cloudflare / GitHub / Vercel.

Local OAuth handlers for Notion/Linear in **nexus-a1** should be disabled; use these MCP endpoints instead.

## Test

```bash
curl -i -X POST "https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/notion" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Nexus-User-Id: $USER_ID" \
  -H "X-Nexus-Signature: $SIGNATURE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

curl -i -X POST "https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/linear" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "X-Nexus-User-Id: $USER_ID" \
  -H "X-Nexus-Signature: $SIGNATURE" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

Expected: official 401 + `www-authenticate` pointing at `mcp.notion.com` / `mcp.linear.app`.
