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
      "d1.metadata_read", "d1.read", "d1.write",
      "vectorize.read", "vectorize.write",
      "workers-kv-storage.metadata_read", "workers-kv-storage.read", "workers-kv-storage.write",
      "workers-r2.metadata_read", "workers-r2.read", "workers-r2.write",
      "workers-r2-bucket-item.read", "workers-r2-bucket-item.write",
      "workers-scripts.bind", "workers-scripts.read", "workers-scripts.write",
      "workers-tail.read",
      "account-settings.read", "user-details.read",
      "offline_access"
    ],
    env: { clientId: "CLOUDFLARE_CLIENT_ID", clientSecret: "CLOUDFLARE_CLIENT_SECRET" }
  },

  vercel: {
    name: "Vercel API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/vercel",
    scopes: [],
    env: { clientId: "VERCEL_CLIENT_ID", clientSecret: "VERCEL_CLIENT_SECRET" },
    note: "Local per-user MCP backed directly by the Vercel REST API (projects, deployments, domains)."
  },

  netlify: {
    name: "Netlify API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/netlify",
    scopes: [],
    env: { clientId: "NETLIFY_CLIENT_ID", clientSecret: "NETLIFY_CLIENT_SECRET" },
    note: "Local per-user MCP backed directly by the Netlify REST API (sites, deploys, builds, env vars)."
  },

  atlassian: {
    name: "Atlassian Jira API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/atlassian",
    scopes: [
      "read:jira-user", "read:jira-work", "write:jira-work",
      "manage:jira-project", "manage:jira-webhook",
      "offline_access"
    ],
    env: { clientId: "ATLASSIAN_CLIENT_ID", clientSecret: "ATLASSIAN_CLIENT_SECRET" },
    note: "Local per-user MCP backed directly by the Jira Cloud REST API."
  },

  googleDeveloperKnowledge: {
    name: "Google Developer Knowledge MCP",
    auth: "api-key",
    mcp: true,
    mcpUrl: "https://developerknowledge.googleapis.com/mcp",
    env: { apiKey: "DEVELOPERKNOWLEDGE_API_KEY" }
  },

  airtable: {
    name: "Airtable API MCP",
    auth: "oauth2",
    pkce: true,
    mcp: true,
    local: true,
    callback: "/oauth/airtable",
    scopes: [
      "data.records:read", "data.records:write",
      "data.recordComments:read", "data.recordComments:write",
      "schema.bases:read", "schema.bases:write",
      "workspacesAndBases:read"
    ],
    env: { clientId: "AIRTABLE_CLIENT_ID", clientSecret: "AIRTABLE_CLIENT_SECRET" },
    note: "Real per-user OAuth (PKCE). Replaces the single shared PAT so every NEXUS user connects their own Airtable account."
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

  sentry: {
    name: "Sentry API MCP",
    auth: "oauth2",
    mcp: true,
    local: true,
    callback: "/oauth/sentry",
    scopes: [
      "org:read", "project:read", "project:write",
      "event:read", "team:read"
    ],
    env: { clientId: "SENTRY_CLIENT_ID", clientSecret: "SENTRY_CLIENT_SECRET" }
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
    env: { clientId: "GOOGLE_CLIENT_ID", clientSecret: "GOOGLE_CLIENT_SECRET" }
  }
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
