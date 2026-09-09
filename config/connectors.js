// Real connector registry for the NEXUS AI MCP gateway.
// Secrets/tokens are NEVER stored here. Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  cloudflare: {
    name: "Cloudflare API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.cloudflare.com/mcp",
    note: "Pure official remote MCP. Transparent proxy. Real Cloudflare consent page."
  },
  vercel: {
    name: "Vercel API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    note: "Pure official remote MCP. Transparent proxy. Real Vercel consent page."
  },
  netlify: {
    name: "Netlify API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://netlify-mcp.netlify.app/mcp",
    note: "Pure official remote MCP. Transparent proxy. Real Netlify consent page."
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
    note: "Pure official remote MCP. Transparent proxy. Real Supabase OAuth consent."
  },
  sentry: {
    name: "Sentry MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.sentry.dev/mcp",
    note: "Pure official remote MCP (https://mcp.sentry.dev). Transparent proxy. Real Sentry OAuth."
  },
  // Local-only (no official remote MCP)
  google: {
    name: "Google API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/google",
    scopes: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/drive.readonly"
    ],
    env: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" },
    note: "Local MCP wrapper only (generic Google APIs)."
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
