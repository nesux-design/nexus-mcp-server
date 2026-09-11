# nexus-a1 OAuth apps → official remote MCP

## Already on nexus-mcp-server (official remote MCP)

| App | mcpUrl | Gateway |
|-----|--------|--------|
| Cloudflare | https://mcp.cloudflare.com/mcp | /mcp/cloudflare |
| Vercel | https://mcp.vercel.com | /mcp/vercel |
| Netlify | https://netlify-mcp.netlify.app/mcp | /mcp/netlify |
| Atlassian | https://mcp.atlassian.com/v1/mcp | /mcp/atlassian |
| GitHub | https://api.githubcopilot.com/mcp/ | /mcp/github |
| Gmail | https://gmailmcp.googleapis.com/mcp/v1 | /mcp/gmail |
| Google Drive | https://drivemcp.googleapis.com/mcp/v1 | /mcp/googleDrive |
| Notion | https://mcp.notion.com/mcp | /mcp/notion |
| Linear | https://mcp.linear.app/mcp | /mcp/linear |
| Asana | https://mcp.asana.com/v2/mcp | /mcp/asana |
| Figma | https://mcp.figma.com/mcp | /mcp/figma |
| HubSpot | https://mcp.hubspot.com | /mcp/hubspot |
| Intercom | https://mcp.intercom.com/mcp | /mcp/intercom |
| Stripe | https://mcp.stripe.com | /mcp/stripe |
| Slack | https://mcp.slack.com/mcp | /mcp/slack |
| Airtable | https://mcp.airtable.com/mcp | /mcp/airtable |
| Supabase | https://mcp.supabase.com/mcp | /mcp/supabase |
| Sentry | https://mcp.sentry.dev/mcp | /mcp/sentry |

## No confirmed official remote MCP (keep local OAuth in nexus-a1 for now)

spotify, dropbox, linkedin, zoom, monday, microsoft, salesforce, twitter, mailchimp, reddit, twitch, telegram, discord, canva, wolfram, zapier*

\* Zapier has MCP but uses per-user server URL / connection token at mcp.zapier.com — not a single shared public endpoint suitable for transparent multi-tenant proxy without per-user setup.

## nexus-a1 cleanup

Remove from `GENERIC_OAUTH_PROVIDERS` / special list any app that is listed in the table above, then point UI connect flows at:

`https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/<id>`
