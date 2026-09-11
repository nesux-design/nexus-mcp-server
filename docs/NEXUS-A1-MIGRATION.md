# nexus-a1 → official remote MCP migration

## On nexus-mcp-server (official remote MCP)

| id | Official mcpUrl |
|----|-----------------|
| cloudflare | https://mcp.cloudflare.com/mcp |
| vercel | https://mcp.vercel.com |
| netlify | https://netlify-mcp.netlify.app/mcp |
| atlassian | https://mcp.atlassian.com/v1/mcp |
| microsoft | https://www.microsoft.com/releasecommunications/mcp |
| github | https://api.githubcopilot.com/mcp/ |
| gmail | https://gmailmcp.googleapis.com/mcp/v1 |
| googleDrive | https://drivemcp.googleapis.com/mcp/v1 |
| notion | https://mcp.notion.com/mcp |
| linear | https://mcp.linear.app/mcp |
| asana | https://mcp.asana.com/v2/mcp |
| figma | https://mcp.figma.com/mcp |
| canva | https://mcp.canva.com/mcp |
| monday | https://mcp.monday.com/mcp |
| hubspot | https://mcp.hubspot.com |
| intercom | https://mcp.intercom.com/mcp |
| stripe | https://mcp.stripe.com |
| slack | https://mcp.slack.com/mcp |
| dropbox | https://mcp.dropbox.com/mcp |
| zapier | https://mcp.zapier.com/api/v1/connect |
| airtable | https://mcp.airtable.com/mcp |
| supabase | https://mcp.supabase.com/mcp |
| sentry | https://mcp.sentry.dev/mcp |

Gateway path: `/mcp/<id>`

## Still no confirmed official remote MCP (keep local in nexus-a1)

spotify, linkedin, zoom, salesforce, twitter, mailchimp, reddit, twitch, telegram, discord, wolfram

## nexus-a1: remove local OAuth for moved apps

From GENERIC_OAUTH_PROVIDERS / special, remove:

asana, airtable, canva, dropbox, figma, github, gmail, google, hubspot, intercom, linear, microsoft, monday, notion, slack, stripe, zapier

Point connect UI to `https://nexus-mcp-server.apikeyakhilka.workers.dev/mcp/<id>`.
