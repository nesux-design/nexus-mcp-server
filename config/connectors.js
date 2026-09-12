// NEXUS MCP gateway connectors.
// Official remote MCP = upstream-oauth + mcpUrl
// Custom MCP (no official host) = local tools + OAuth token / bridge / api-key

export const CONNECTORS = {
  // ===== Official remote MCP =====
  cloudflare: { name: "Cloudflare API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.cloudflare.com/mcp" },
  vercel: { name: "Vercel API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.vercel.com" },
  netlify: { name: "Netlify API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://netlify-mcp.netlify.app/mcp" },
  atlassian: { name: "Atlassian Rovo MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.atlassian.com/v1/mcp" },
  microsoft: { name: "Microsoft Release Communications MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://www.microsoft.com/releasecommunications/mcp" },
  googleDeveloperKnowledge: { name: "Google Developer Knowledge MCP", auth: "api-key", mcp: true, mcpUrl: "https://developerknowledge.googleapis.com/mcp", env: { apiKey: "DEVELOPERKNOWLEDGE_API_KEY" } },
  googleDrive: { name: "Google Drive MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://drivemcp.googleapis.com/mcp/v1" },
  gmail: { name: "Gmail MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://gmailmcp.googleapis.com/mcp/v1" },
  github: { name: "GitHub MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://api.githubcopilot.com/mcp/" },
  notion: { name: "Notion MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.notion.com/mcp" },
  linear: { name: "Linear MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.linear.app/mcp" },
  asana: { name: "Asana MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.asana.com/v2/mcp" },
  figma: { name: "Figma MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.figma.com/mcp" },
  canva: { name: "Canva MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.canva.com/mcp" },
  monday: { name: "monday.com MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.monday.com/mcp" },
  hubspot: { name: "HubSpot MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.hubspot.com" },
  intercom: { name: "Intercom MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.intercom.com/mcp" },
  stripe: { name: "Stripe MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.stripe.com" },
  slack: { name: "Slack MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.slack.com/mcp" },
  dropbox: { name: "Dropbox MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.dropbox.com/mcp" },
  zapier: { name: "Zapier MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.zapier.com/api/v1/connect" },
  airtable: { name: "Airtable MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.airtable.com/mcp" },
  supabase: { name: "Supabase MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.supabase.com/mcp", projectRefEnv: "SUPABASE_PROJECT_REF", readOnlySupported: true },
  sentry: { name: "Sentry MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.sentry.dev/mcp" },

  // ===== 10 custom MCP (nexus-a1 transfer) — OAuth/API but MCP protocol =====
  telegram: {
    name: "Telegram MCP",
    auth: "bridge",
    mcp: true,
    bridgeUrlEnv: "NEXUS_TELEGRAM_MCP_URL",
    bridgeSecretEnv: "NEXUS_TELEGRAM_BRIDGE_SECRET",
    defaultBridgeUrl: "https://nexus-bridge-hlp2.onrender.com/mcp",
    note: "Custom MCP via Render GramJS bridge"
  },
  discord: { name: "Discord MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Discord OAuth token" },
  reddit: { name: "Reddit MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Reddit OAuth token" },
  mailchimp: { name: "Mailchimp MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Mailchimp OAuth token" },
  spotify: { name: "Spotify MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Spotify OAuth token" },
  zoom: { name: "Zoom MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Zoom OAuth token" },
  twitch: { name: "Twitch MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Twitch OAuth token" },
  salesforce: { name: "Salesforce MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — needs instance_url in token record" },
  twitter: { name: "X (Twitter) MCP", auth: "oauth2", mcp: true, local: true, note: "Custom MCP — nexus-a1 Twitter OAuth2 token" },
  wolfram: { name: "Wolfram Alpha MCP", auth: "api-key", mcp: true, local: true, note: "Custom MCP — WOLFRAM_APP_ID secret" }
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
      note: value.note || null
    }));
}
