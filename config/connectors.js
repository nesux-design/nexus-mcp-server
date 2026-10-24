// NEXUS MCP gateway connectors.
// Official remote MCP = upstream-oauth | provider-approved-oauth | api-key | oauth2+mcpUrl
// Local-only = oauth2|bridge|api-key with local:true (no vendor remote MCP exists)

export const CONNECTORS = {
  cloudflare: { name: "Cloudflare API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.cloudflare.com/mcp" },
  vercel: {
    name: "Vercel API MCP",
    auth: "provider-approved-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    oauthClientPolicy: "approved-only",
    note: "Vercel rejects generic DCR (invalid_redirect_uri). Needs pre-approved OAuth client."
  },
  netlify: { name: "Netlify API MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://netlify-mcp.netlify.app/mcp" },
  atlassian: { name: "Atlassian Rovo MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.atlassian.com/v2/mcp" },
  microsoft: {
    name: "Microsoft Release Communications MCP",
    auth: "provider-approved-oauth",
    mcp: true,
    mcpUrl: "https://www.microsoft.com/releasecommunications/mcp",
    note: "No public OAuth protected-resource metadata; not DCR-ready."
  },
  googleDeveloperKnowledge: {
    name: "Google Developer Knowledge MCP",
    auth: "api-key",
    mcp: true,
    mcpUrl: "https://developerknowledge.googleapis.com/mcp",
    env: { apiKey: "DEVELOPERKNOWLEDGE_API_KEY" }
  },
  googleDrive: {
    name: "Google Drive MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://drivemcp.googleapis.com/mcp/v1",
    env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" },
    callback: "/oauth/googleDrive/callback",
    scopes: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/drive.file",
      "openid",
      "email",
      "profile"
    ],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Google Drive remote MCP."
  },
  googleCalendar: {
    name: "Google Calendar MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://calendarmcp.googleapis.com/mcp/v1",
    env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" },
    callback: "/oauth/googleCalendar/callback",
    scopes: [
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
      "openid",
      "email",
      "profile"
    ],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Google Calendar remote MCP."
  },
  gmail: {
    name: "Google Gmail MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://gmailmcp.googleapis.com/mcp/v1",
    env: { clientId: "GOOGLE_MCP_CLIENT_ID", clientSecret: "GOOGLE_MCP_CLIENT_SECRET" },
    callback: "/oauth/gmail/callback",
    scopes: [
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.compose",
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.modify"
    ],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Google-hosted Gmail remote MCP."
  },
  github: {
    name: "GitHub MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://api.githubcopilot.com/mcp/",
    env: { clientId: "GITHUB_CLIENT_ID", clientSecret: "GITHUB_CLIENT_SECRET" },
    callback: "/oauth/github/callback",
    scopes: ["repo", "read:user", "user:email", "workflow"],
    pkce: true,
    note: "Official remote GitHub MCP (api.githubcopilot.com)."
  },
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
    note: "Official Asana MCP."
  },
  figma: {
    name: "Figma Remote MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.figma.com/mcp",
    resourceMetadataUrl: "https://mcp.figma.com/.well-known/oauth-protected-resource",
    env: { clientId: "FIGMA_CLIENT_ID", clientSecret: "FIGMA_CLIENT_SECRET" },
    callback: "/oauth/figma/callback",
    scopes: ["mcp:connect"],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Figma MCP. Create Figma OAuth app for MCP; secrets FIGMA_CLIENT_ID + FIGMA_CLIENT_SECRET. Redirect: .../oauth/figma/callback."
  },
  canva: { name: "Canva MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.canva.com/mcp" },
  monday: {
    name: "monday.com MCP",
    auth: "provider-approved-oauth",
    mcp: true,
    mcpUrl: "https://mcp.monday.com/mcp",
    note: "monday requires pre-approved redirect_uris."
  },
  hubspot: {
    name: "HubSpot MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.hubspot.com",
    resourceMetadataUrl: "https://mcp.hubspot.com/.well-known/oauth-protected-resource",
    env: { clientId: "HUBSPOT_MCP_CLIENT_ID", clientSecret: "HUBSPOT_MCP_CLIENT_SECRET" },
    callback: "/oauth/hubspot/callback",
    scopes: [],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official HubSpot MCP. Secrets: HUBSPOT_MCP_CLIENT_ID + HUBSPOT_MCP_CLIENT_SECRET. Redirect: .../oauth/hubspot/callback."
  },
  intercom: {
    name: "Intercom MCP",
    auth: "provider-approved-oauth",
    mcp: true,
    mcpUrl: "https://mcp.intercom.com/mcp",
    note: "Intercom rejects unregistered redirect_uri."
  },
  stripe: { name: "Stripe MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.stripe.com" },
  slack: {
    name: "Slack MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.slack.com/mcp",
    resourceMetadataUrl: "https://mcp.slack.com/.well-known/oauth-protected-resource",
    env: { clientId: "SLACK_MCP_CLIENT_ID", clientSecret: "SLACK_MCP_CLIENT_SECRET" },
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Slack remote MCP + static Slack app."
  },
  dropbox: {
    name: "Dropbox MCP",
    auth: "provider-approved-oauth",
    mcp: true,
    mcpUrl: "https://mcp.dropbox.com/mcp",
    note: "Trusted partners only."
  },
  zapier: { name: "Zapier MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.zapier.com/api/v1/connect" },
  airtable: { name: "Airtable MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.airtable.com/mcp" },
  supabase: {
    name: "Supabase MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true
  },
  sentry: { name: "Sentry MCP", auth: "upstream-oauth", mcp: true, mcpUrl: "https://mcp.sentry.dev/mcp" },

  twitter: {
    name: "X (Twitter) MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://api.x.com/mcp",
    resourceMetadataUrl: "https://api.x.com/.well-known/oauth-protected-resource/mcp",
    env: { clientId: "TWITTER_CLIENT_ID", clientSecret: "TWITTER_CLIENT_SECRET" },
    callback: "/oauth/twitter/callback",
    scopes: [
      "tweet.read",
      "users.read",
      "offline.access",
      "bookmark.read",
      "like.read",
      "list.read",
      "follows.read"
    ],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_basic",
    note: "Official X remote MCP. Secrets: TWITTER_CLIENT_ID + TWITTER_CLIENT_SECRET."
  },

  zoom: {
    name: "Zoom MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.zoom.us/mcp/zoom/streamable",
    resourceMetadataUrl: "https://zoom.us/.well-known/oauth-protected-resource/mcp/zoom/streamable",
    env: { clientId: "ZOOM_CLIENT_ID", clientSecret: "ZOOM_CLIENT_SECRET" },
    callback: "/oauth/zoom/callback",
    scopes: [
      "meeting:read:search",
      "meeting:read:assets",
      "meeting:write:meeting",
      "meeting:update:meeting",
      "meeting:delete:meeting",
      "cloud_recording:read:list_user_recordings",
      "cloud_recording:read:content",
      "docs:read:export",
      "docs:write:import",
      "hub:read:content",
      "hub:write:content",
      "agentic_search:read:search"
    ],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_basic",
    note: "Official Zoom remote MCP. Secrets: ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET."
  },

  salesforce: {
    name: "Salesforce Hosted MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://api.salesforce.com/platform/mcp/v1/platform/sobject-all",
    env: { clientId: "SALESFORCE_CLIENT_ID", clientSecret: "SALESFORCE_CLIENT_SECRET" },
    callback: "/oauth/salesforce/callback",
    scopes: ["mcp_api", "refresh_token", "api"],
    pkce: true,
    tokenEndpointAuthMethod: "client_secret_post",
    note: "Official Salesforce Hosted MCP (sobject-all). External Client App + mcp_api. Secrets: SALESFORCE_CLIENT_ID + SALESFORCE_CLIENT_SECRET."
  },

  // No vendor-hosted remote MCP — keep local/bridge only
  telegram: { name: "Telegram MCP", auth: "bridge", mcp: true, local: true, note: "Custom bridge — no official remote MCP" },
  discord: { name: "Discord MCP", auth: "oauth2", mcp: true, local: true, note: "No official Discord remote MCP (use A1 plugins)" },
  reddit: { name: "Reddit MCP", auth: "oauth2", mcp: true, local: true, note: "No official remote MCP" },
  mailchimp: { name: "Mailchimp MCP", auth: "oauth2", mcp: true, local: true, note: "No official full Marketing remote MCP" },
  spotify: { name: "Spotify MCP", auth: "oauth2", mcp: true, local: true, note: "No official Spotify remote MCP (use A1 plugins)" },
  twitch: { name: "Twitch MCP", auth: "oauth2", mcp: true, local: true, note: "No official remote MCP" },
  wolfram: { name: "Wolfram Alpha MCP", auth: "api-key", mcp: true, local: true, note: "API key local tools" }
};

export function publicConnectorList() {
  return Object.entries(CONNECTORS)
    .filter(([, value]) => value.mcp === true)
    .map(([id, value]) => {
      const secrets = [];
      if (value.env?.clientId) secrets.push(value.env.clientId);
      if (value.env?.clientSecret) secrets.push(value.env.clientSecret);
      if (value.env?.apiKey) secrets.push(value.env.apiKey);
      return {
        id,
        name: value.name,
        auth: value.auth,
        local: Boolean(value.local),
        remoteMcp: Boolean(value.mcpUrl),
        mcpUrl: value.mcpUrl || null,
        callback: value.callback || (value.mcpUrl ? `/oauth/${id}/callback` : null),
        requiredSecrets: secrets,
        note: value.note || null,
        oauthReady:
          value.auth === "upstream-oauth" ||
          value.auth === "oauth2" ||
          value.auth === "api-key",
        providerApprovedOnly: value.auth === "provider-approved-oauth"
      };
    });
}
