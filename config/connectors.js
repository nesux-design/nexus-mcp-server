// Real connector registry for the NEXUS AI MCP gateway.
// Secrets/tokens are NEVER stored here. Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  cloudflare: {
    name: "Cloudflare API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.cloudflare.com/mcp",
    note: "Pure official remote MCP. Transparent proxy."
  },
  vercel: {
    name: "Vercel API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    note: "Pure official remote MCP. Transparent proxy."
  },
  netlify: {
    name: "Netlify API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://netlify-mcp.netlify.app/mcp",
    note: "Pure official remote MCP. Transparent proxy."
  },
  atlassian: {
    name: "Atlassian Rovo MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.atlassian.com/v1/mcp",
    note: "Pure official remote MCP. Transparent proxy."
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
  github: {
    name: "GitHub MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://api.githubcopilot.com/mcp/",
    note: "Official GitHub remote MCP."
  },
  // Round: Notion + Linear (moved from nexus-a1 local OAuth)
  notion: {
    name: "Notion MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.notion.com/mcp",
    note: "Official Notion remote MCP. Real Notion OAuth consent."
  },
  linear: {
    name: "Linear MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.linear.app/mcp",
    note: "Official Linear remote MCP. Real Linear OAuth consent."
  },
  airtable: {
    name: "Airtable MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.airtable.com/mcp",
    note: "Pure official remote MCP. Transparent proxy."
  },
  supabase: {
    name: "Supabase MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true,
    note: "Pure official remote MCP. Transparent proxy."
  },
  sentry: {
    name: "Sentry MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.sentry.dev/mcp",
    note: "Pure official remote MCP. Transparent proxy."
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
      readOnlySupported: value.readOnlySupported,
      note: value.note
    }));
}
