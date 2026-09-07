// Real connector registry for the NEXUS AI MCP gateway.
// Secrets/tokens are NEVER stored here. Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  cloudflare: {
    name: "Cloudflare API MCP",
    auth: "upstream-oauth",          // Official MCP owns the OAuth + consent page
    mcp: true,
    mcpUrl: "https://mcp.cloudflare.com/mcp",
    // No local: true  → always use the real official remote MCP
    note: "Pure official remote MCP. Users see Cloudflare's real consent page (Read only / Full access / Custom)."
  },
  vercel: {
    name: "Vercel API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    note: "Pure official remote MCP (Vercel owns OAuth + consent)."
  },
  netlify: {
    name: "Netlify API MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://netlify-mcp.netlify.app/mcp",
    note: "Pure official remote MCP (Netlify owns OAuth + consent)."
  },
  atlassian: {
    name: "Atlassian Rovo MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.atlassian.com/v1/mcp",
    note: "Pure official remote MCP when available."
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
    note: "Pure official remote MCP when available."
  },
  supabase: {
    name: "Supabase MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true,
    note: "Pure official remote MCP. Supabase owns the OAuth flow."
  },
  // Local-only fallbacks (no official remote MCP claimed)
  sentry: {
    name: "Sentry API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/sentry",
    scopes: ["org:read", "project:read", "project:write", "event:read", "team:read"],
    env: { clientId: "SENTRY_CLIENT_ID", clientSecret: "SENTRY_CLIENT_SECRET" },
    note: "Local MCP wrapper (no official remote MCP endpoint)."
  },
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
    note: "Local MCP wrapper (no official remote MCP endpoint)."
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
