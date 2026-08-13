// Nexus connector registry.
// Secrets/tokens are intentionally NOT stored here. Put them in Cloudflare
// Worker secrets/vars and reference them from provider implementations.

export const CONNECTORS = {
  cloudflare: { name: "Cloudflare", auth: "oauth2", callback: "/oauth/cloud" },
  vercel: { name: "Vercel", auth: "oauth2", callback: "/oauth/vercel" },
  netlify: { name: "Netlify", auth: "oauth2", callback: "/oauth/netlify" },
  sentry: { name: "Sentry", auth: "oauth2", callback: "/oauth/sentry" },
  atlassian: { name: "Atlassian / Jira", auth: "oauth2", callback: "/oauth/atlassian" },
  google: { name: "Google", auth: "oauth2", callback: "/oauth/google" },
  airtable: { name: "Airtable", auth: "pat", mcpUrl: "https://mcp.airtable.com/mcp" },
  supabase: {
    name: "Supabase",
    auth: "remote-mcp-oauth",
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRef: "dexsatutwvyxjerlorbd"
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
  return Object.entries(CONNECTORS).map(([id, value]) => ({ id, ...value }));
}
