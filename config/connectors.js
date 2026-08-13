// Central connector registry. Secrets/tokens are NEVER stored here.
// Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  cloudflare: {
    name: "Cloudflare",
    auth: "oauth2",
    callback: "/oauth/cloud",
    scopes: [
      "d1.metadata_read", "d1.read", "d1.write",
      "vectorize.read", "vectorize.write",
      "workers-kv-storage.metadata_read", "workers-kv-storage.read", "workers-kv-storage.write",
      "workers-r2.metadata_read", "workers-r2.read", "workers-r2.write",
      "workers-r2-bucket-item.read", "workers-r2-bucket-item.write",
      "workers-scripts.bind", "workers-scripts.read", "workers-scripts.write",
      "workers-tail.read", "offline_access"
    ],
    env: { clientId: "CLOUDFLARE_CLIENT_ID", clientSecret: "CLOUDFLARE_CLIENT_SECRET" }
  },
  vercel: { name: "Vercel", auth: "oauth2", callback: "/oauth/vercel", env: { clientId: "VERCEL_CLIENT_ID", clientSecret: "VERCEL_CLIENT_SECRET" } },
  netlify: { name: "Netlify", auth: "oauth2", callback: "/oauth/netlify", env: { clientId: "NETLIFY_CLIENT_ID", clientSecret: "NETLIFY_CLIENT_SECRET" } },
  sentry: { name: "Sentry", auth: "oauth2", callback: "/oauth/sentry", env: { clientId: "SENTRY_CLIENT_ID", clientSecret: "SENTRY_CLIENT_SECRET" } },
  atlassian: {
    name: "Atlassian / Jira",
    auth: "oauth2",
    callback: "/oauth/atlassian",
    scopes: ["read:jira-user", "read:jira-work", "write:jira-work", "manage:jira-project", "manage:jira-webhook"],
    env: { clientId: "ATLASSIAN_CLIENT_ID", clientSecret: "ATLASSIAN_CLIENT_SECRET" }
  },
  google: { name: "Google", auth: "oauth2", callback: "/oauth/google", env: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" } },
  airtable: {
    name: "Airtable",
    auth: "pat",
    mcpUrl: "https://mcp.airtable.com/mcp",
    env: { token: "AIRTABLE_PAT" }
  },
  supabase: {
    name: "Supabase",
    auth: "remote-mcp-oauth",
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true
  },
  notion: { name: "Notion", auth: "existing" },
  slack: { name: "Slack", auth: "existing" },
  googleDrive: { name: "Google Drive", auth: "existing" },
  googleCalendar: { name: "Google Calendar", auth: "existing" },
  gmail: { name: "Gmail", auth: "existing" },
  linear: { name: "Linear", auth: "existing" },
  dropbox: { name: "Dropbox", auth: "existing" },
  hubspot: { name: "HubSpot", auth: "existing" },
  asana: { name: "Asana", auth: "existing" },
  monday: { name: "Monday.com", auth: "existing" },
  googleSheets: { name: "Google Sheets", auth: "existing" },
  salesforce: { name: "Salesforce", auth: "existing" },
  twilio: { name: "Twilio", auth: "existing" },
  zoom: { name: "Zoom", auth: "existing" },
  figma: { name: "Figma", auth: "existing" }
};

export function publicConnectorList() {
  return Object.entries(CONNECTORS).map(([id, value]) => ({
    id,
    name: value.name,
    auth: value.auth,
    callback: value.callback,
    mcpUrl: value.mcpUrl,
    readOnlySupported: value.readOnlySupported
  }));
}
