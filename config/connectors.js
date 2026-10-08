// NEXUS MCP gateway connectors.
// Official remote MCP = upstream-oauth | provider-approved-oauth | api-key
// Local/custom MCP = oauth2 | bridge | api-key (nexus-a1 tokens)

export const CONNECTORS = {
  cloudflare: { name: "Cloudflare API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.cloudflare.com/mcp" },
  vercel: { name: "Vercel API MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://mcp.vercel.com", oauthClientPolicy: "approved-only", note: "Vercel MCP requires an approved OAuth client; Nexus DCR is rejected by Vercel with invalid_redirect_uri." },
  netlify: { name: "Netlify API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://netlify-mcp.netlify.app/mcp" },
  atlassian: { name: "Atlassian Rovo MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.atlassian.com/v2/mcp" },
  microsoft: { name: "Microsoft Release Communications MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://www.microsoft.com/releasecommunications/mcp", note: "No public OAuth protected-resource metadata; not DCR-ready." },
  googleDeveloperKnowledge: { name: "Google Developer Knowledge MCP", auth: "api-key", mcp: true, mcpUrl: "https://developerknowledge.googleapis.com/mcp", env: { apiKey: "DEVELOPERKNOWLEDGE_API_KEY" } },
  googleDrive: { name: "Google Drive API MCP", auth: "oauth2", mcp: true, local: true, env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" }, callback: "/oauth/googleDrive/callback", scopes: ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/drive.file"], pkce: true, tokenEndpointAuthMethod: "client_secret_post", note: "NEXUS implements Google Drive MCP tools directly against the Drive API v3; the official Google Drive MCP server is not proxied." },
  googleCalendar: { name: "Google Calendar API MCP", auth: "oauth2", mcp: true, local: true, env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" }, callback: "/oauth/googleCalendar/callback", scopes: ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/calendar.events"], pkce: true, tokenEndpointAuthMethod: "client_secret_post", note: "NEXUS implements Google Calendar MCP tools directly against the Calendar API v3; the official Google Calendar MCP server is not proxied." },
  gmail: { name: "Google Gmail MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://gmailmcp.googleapis.com/mcp/v1", env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" }, callback: "/oauth/gmail/callback", scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.compose", "https://www.googleapis.com/auth/gmail.send", "https://www.googleapis.com/auth/gmail.modify"], pkce: true, tokenEndpointAuthMethod: "client_secret_post", note: "Official Google-hosted Gmail remote MCP over Streamable HTTP. NEXUS brokers the user's OAuth token and proxies MCP requests; it does not implement Gmail API tools." },
  github: { name: "GitHub API MCP", auth: "oauth2", mcp: true, local: true, env: { clientId: "GITHUB_CLIENT_ID", clientSecret: "GITHUB_CLIENT_SECRET" }, callback: "/oauth/github/callback", scopes: ["repo", "read:user", "user:email"], pkce: true, note: "NEXUS implements GitHub MCP tools directly against the GitHub API; the official GitHub MCP server is not proxied." },
  notion: { name: "Notion MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.notion.com/mcp" },
  linear: { name: "Linear MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.linear.app/mcp" },
  asana: {
    name: "Asana MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.asana.com/v2/mcp",
    env: { clientId: "ASANA_MCP_CLIENT_ID", clientSecret: "ASANA_MCP_CLIENT_SECRET" },
    callback: "/oauth/asana/callback",
    scopes: ["default"],
    pkce: true,
    note: "No DCR. Create Asana OAuth app → redirect https://nexus-mcp-server.apikeyakhilka.workers.dev/oauth/asana/callback → set ASANA_MCP_CLIENT_ID + ASANA_MCP_CLIENT_SECRET. Then GET /oauth/asana/start → 302 Location."
  },
  figma: { name: "Figma MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://mcp.figma.com/mcp", note: "Figma DCR returns 403 for generic clients; register Nexus or use approved client." },
  canva: { name: "Canva MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.canva.com/mcp" },
  monday: { name: "monday.com MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://mcp.monday.com/mcp", note: "monday requires pre-approved redirect_uris; contact monday to allow Nexus callback." },
  hubspot: { name: "HubSpot MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.hubspot.com", env: { clientId: "HUBSPOT_MCP_CLIENT_ID", clientSecret: "HUBSPOT_MCP_CLIENT_SECRET" }, note: "No DCR — set HUBSPOT_MCP_CLIENT_ID/SECRET" },
  intercom: { name: "Intercom MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://mcp.intercom.com/mcp", note: "Intercom rejects unregistered redirect_uri (invalid_redirect_uri)." },
  stripe: { name: "Stripe MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.stripe.com" },
  slack: { name: "Slack MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.slack.com/mcp", resourceMetadataUrl: "https://mcp.slack.com/.well-known/oauth-protected-resource", env: { clientId: "SLACK_MCP_CLIENT_ID", clientSecret: "SLACK_MCP_CLIENT_SECRET" }, tokenEndpointAuthMethod: "client_secret_post", note: "Slack MCP uses a fixed registered Slack app and confidential OAuth; DCR is not supported. End users only complete Slack OAuth." },
  dropbox: { name: "Dropbox MCP", auth: "provider-approved-oauth", mcp: true, mcpUrl: "https://mcp.dropbox.com/mcp", note: "Dropbox returns registration_not_supported; needs static OAuth app." },
  zapier: { name: "Zapier MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.zapier.com/api/v1/connect" },
  airtable: { name: "Airtable MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.airtable.com/mcp" },
  supabase: { name: "Supabase MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.supabase.com/mcp", projectRefEnv: "SUPABASE_PROJECT_REF", readOnlySupported: true },
  sentry: { name: "Sentry MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.sentry.dev/mcp" },

  telegram: { name: "Telegram MCP", auth: "bridge", mcp: true, local: true, note: "Custom bridge" },
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
      local: Boolean(value.local),
      note: value.note || null,
      oauthReady: value.auth === "upstream-oauth" || value.auth === "oauth2" || value.auth === "api-key",
    }));
}
