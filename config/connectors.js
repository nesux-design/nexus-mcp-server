// Real connector registry for the NEXUS AI MCP gateway.
// Secrets/tokens are NEVER stored here. Put credentials in Cloudflare Worker secrets/vars.

export const CONNECTORS = {
  cloudflare: {
    name: "Cloudflare API MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.cloudflare.com/mcp",
    callback: "/oauth/cloud",
    scopes: [
      "account.read",
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

  vercel: {
    name: "Vercel MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.vercel.com",
    note: "Vercel MCP uses Vercel's own MCP authorization and approved-client controls. Do not treat a generic Vercel API OAuth token as an MCP token."
  },

  netlify: {
    name: "Netlify MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://netlify-mcp.netlify.app/mcp",
    note: "Authentication is performed by the official Netlify MCP service."
  },

  atlassian: {
    name: "Atlassian Rovo MCP",
    auth: "oauth2",
    mcp: true,
    mcpUrl: "https://mcp.atlassian.com/v1/mcp",
    callback: "/oauth/atlassian",
    scopes: ["read:jira-user", "read:jira-work", "write:jira-work", "manage:jira-project", "manage:jira-webhook"],
    env: { clientId: "ATLASSIAN_CLIENT_ID", clientSecret: "ATLASSIAN_CLIENT_SECRET" }
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
    auth: "pat",
    mcp: true,
    mcpUrl: "https://mcp.airtable.com/mcp",
    env: { token: "AIRTABLE_PAT" }
  },

  supabase: {
    name: "Supabase MCP",
    auth: "upstream-oauth",
    mcp: true,
    mcpUrl: "https://mcp.supabase.com/mcp",
    projectRefEnv: "SUPABASE_PROJECT_REF",
    readOnlySupported: true,
    note: "Supabase owns the MCP OAuth flow; a normal Supabase API token is not silently substituted for MCP authorization."
  },

  // OAuth-only integrations remain available for the existing NEXUS integration layer,
  // but are deliberately NOT advertised as MCP connectors without an official MCP upstream.
  sentry: { name: "Sentry OAuth", auth: "oauth2", callback: "/oauth/sentry", mcp: false, env: { clientId: "SENTRY_CLIENT_ID", clientSecret: "SENTRY_CLIENT_SECRET" } },
  google: { name: "Google OAuth", auth: "oauth2", callback: "/oauth/google", mcp: false, env: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" } }
};

export function publicConnectorList() {
  return Object.entries(CONNECTORS)
    .filter(([, value]) => value.mcp === true)
    .map(([id, value]) => ({
      id,
      name: value.name,
      auth: value.auth,
      mcpUrl: value.mcpUrl,
      readOnlySupported: value.readOnlySupported,
      note: value.note
    }));
}
