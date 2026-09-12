// Real connector registry for the NEXUS AI MCP gateway.
// Secrets/tokens are NEVER stored here. Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  // --- Infra / platform ---
  cloudflare: {
    name: "Cloudflare API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.cloudflare.com/mcp",
    note: "Official remote MCP. Transparent proxy."
  },
  vercel: {
    name: "Vercel API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    note: "Official remote MCP. Transparent proxy."
  },
  netlify: {
    name: "Netlify API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://netlify-mcp.netlify.app/mcp",
    note: "Official remote MCP. Transparent proxy."
  },
  atlassian: {
    name: "Atlassian Rovo MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.atlassian.com/v1/mcp",
    note: "Official remote MCP. Transparent proxy."
  },
  microsoft: {
    name: "Microsoft Release Communications MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://www.microsoft.com/releasecommunications/mcp",
    note: "Official Microsoft remote MCP (roadmap / release communications)."
  },

  // --- Google ---
  googleDeveloperKnowledge: {
    name: "Google Developer Knowledge MCP",
    auth: "api-key",
    mcp: true,
    mcpUrl: "https://developerknowledge.googleapis.com/mcp",
    env: { apiKey: "DEVELOPERKNOWLEDGE_API_KEY" }
  },
  googleDrive: {
    name: "Google Drive MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://drivemcp.googleapis.com/mcp/v1",
    note: "Official Google Drive remote MCP."
  },
  gmail: {
    name: "Gmail MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://gmailmcp.googleapis.com/mcp/v1",
    note: "Official Gmail remote MCP."
  },

  // --- Dev / product ---
  github: {
    name: "GitHub MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://api.githubcopilot.com/mcp/",
    note: "Official GitHub remote MCP."
  },
  notion: {
    name: "Notion MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.notion.com/mcp",
    note: "Official Notion remote MCP."
  },
  linear: {
    name: "Linear MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.linear.app/mcp",
    note: "Official Linear remote MCP."
  },
  asana: {
    name: "Asana MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.asana.com/v2/mcp",
    note: "Official Asana V2 remote MCP."
  },
  figma: {
    name: "Figma MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.figma.com/mcp",
    note: "Official Figma remote MCP."
  },
  canva: {
    name: "Canva MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.canva.com/mcp",
    note: "Official Canva remote MCP."
  },
  monday: {
    name: "monday.com MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.monday.com/mcp",
    note: "Official monday.com hosted remote MCP."
  },

  // --- CRM / support / payments ---
  hubspot: {
    name: "HubSpot MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.hubspot.com",
    note: "Official HubSpot remote MCP."
  },
  intercom: {
    name: "Intercom MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.intercom.com/mcp",
    note: "Official Intercom remote MCP."
  },
  stripe: {
    name: "Stripe MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.stripe.com",
    note: "Official Stripe remote MCP."
  },
  slack: {
    name: "Slack MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.slack.com/mcp",
    note: "Official Slack remote MCP."
  },

  // --- Storage / automation ---
  dropbox: {
    name: "Dropbox MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.dropbox.com/mcp",
    note: "Official Dropbox remote MCP."
  },
  zapier: {
    name: "Zapier MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.zapier.com/api/v1/connect",
    note: "Official Zapier remote MCP (OAuth / connection token)."
  },

  // --- Data / observability ---
  airtable: {
    name: "Airtable MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.airtable.com/mcp",
    note: "Official Airtable remote MCP."
  },
  supabase: {
    name: "Supabase MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true,
    note: "Official Supabase remote MCP."
  },
  sentry: {
    name: "Sentry MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.sentry.dev/mcp",
    note: "Official Sentry remote MCP."
  },

  // --- Custom MCP (no official remote MCP — OAuth/API or bridge) ---
  telegram: {
    name: "Telegram MCP (Nexus bridge)",
    auth: "bridge",
    mcp: true,
    local: false,
    mcpUrl: null,
    bridgeUrlEnv: "NEXUS_TELEGRAM_MCP_URL",
    bridgeSecretEnv: "NEXUS_TELEGRAM_BRIDGE_SECRET",
    defaultBridgeUrl: "https://nexus-bridge-hlp2.onrender.com/mcp",
    note: "Custom Level-3 MCP via Render GramJS bridge. Set NEXUS_TELEGRAM_MCP_URL + NEXUS_TELEGRAM_BRIDGE_SECRET."
  },
  discord: {
    name: "Discord MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Discord OAuth token (nexus-a1 OAuth)."
  },
  reddit: {
    name: "Reddit MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Reddit OAuth token."
  },
  mailchimp: {
    name: "Mailchimp MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Mailchimp OAuth token."
  },
  spotify: {
    name: "Spotify MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Spotify OAuth token."
  },
  zoom: {
    name: "Zoom MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Zoom OAuth token."
  },
  twitch: {
    name: "Twitch MCP (custom)",
    auth: "oauth2",
    mcp: true,
    local: true,
    note: "Custom MCP. Uses stored Twitch OAuth token."
  },
  wolfram: {
    name: "Wolfram Alpha MCP (custom)",
    auth: "api-key",
    mcp: true,
    local: true,
    note: "Custom MCP. Set WOLFRAM_APP_ID worker secret."
  }
};

export function publicConnectorList() {
  return Object.entries(CONNECTORS)
    .filter(([, value]) => value.mcp === true)
    .map(([id, value]) => ({
      id,
      name: value.name,
      auth: value.auth,
      mcpUrl: value.mcpUrl || null,
      local: Boolean(value.local),
      bridge: value.auth === "bridge",
      readOnlySupported: value.readOnlySupported,
      note: value.note
    }));
}
