# Add custom MCP (Claude / Grok style)

Users can register any **https** remote MCP URL. The gateway proxies JSON-RPC transparently and **forwards upstream OAuth challenges** (`401` + `WWW-Authenticate` + `resource_metadata`) so the client completes the **real provider consent** — same pattern as adding Cloudflare MCP in Claude.

## API

All routes require NEXUS internal auth headers:

```
X-Nexus-User-Id: <userId>
X-Nexus-Signature: <hmac-sha256-hex of userId with NEXUS_INTERNAL_AUTH_SECRET>
```

### List

`GET /custom-mcp`

### Add

`POST /custom-mcp`

```json
{ "name": "Cloudflare", "url": "https://mcp.cloudflare.com/mcp" }
```

Response includes `mcpPath`: `/mcp/custom/<id>`

### Delete

`DELETE /custom-mcp/<id>`

### Use (MCP JSON-RPC)

`POST /mcp/custom/<id>`

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-06-18",
    "capabilities": {},
    "clientInfo": { "name": "nexus", "version": "1.0" }
  }
}
```

If upstream needs OAuth you get **401** with `WWW-Authenticate` pointing at their `resource_metadata`. Complete that flow in the client, then retry with `Authorization: Bearer <upstream-token>` (gateway forwards it).

## Security

- HTTPS only
- Localhost / private IPs blocked (SSRF)
- Max 25 custom connectors per user
- NEXUS headers stripped before upstream
