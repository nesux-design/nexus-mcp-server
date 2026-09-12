# 10 custom MCPs transferred from nexus-a1

These have **no official hosted MCP**. They expose the same MCP JSON-RPC API on the gateway.

| id | Path | Auth |
|----|------|------|
| telegram | /mcp/telegram | Render bridge (GramJS) |
| discord | /mcp/discord | OAuth token from nexus-a1 |
| reddit | /mcp/reddit | OAuth token |
| mailchimp | /mcp/mailchimp | OAuth token |
| spotify | /mcp/spotify | OAuth token |
| zoom | /mcp/zoom | OAuth token |
| twitch | /mcp/twitch | OAuth token + TWITCH_CLIENT_ID |
| salesforce | /mcp/salesforce | OAuth token + instance_url |
| twitter | /mcp/twitter | OAuth2 token (X API) |
| wolfram | /mcp/wolfram | WOLFRAM_APP_ID secret |

## Flow

1. User connects app in **nexus-a1** (existing OAuth UI) → token stored.
2. AI / client calls `https://nexus-mcp-server.../mcp/<id>` with NEXUS user signature.
3. Gateway loads token → runs tool → returns MCP `tools/call` result.

Telegram: uses Render Level-3 bridge; set `NEXUS_TELEGRAM_MCP_URL` + `NEXUS_TELEGRAM_BRIDGE_SECRET`.

## nexus-a1 cleanup (optional)

After deploy, you can stop treating these as local chat plugins and only keep OAuth connect for token minting:

discord, reddit, mailchimp, spotify, zoom, twitch, salesforce, twitter, telegram, wolfram
