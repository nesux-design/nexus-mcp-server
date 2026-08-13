# Nexus MCP connector setup

This worker is the gateway between Nexus A1 and external MCP providers.

## Current verified configuration

- Cloudflare OAuth client: callback `/oauth/cloud` and the Cloudflare scopes configured in `config/connectors.js`.
- Vercel OAuth: `/oauth/vercel`.
- Netlify OAuth: `/oauth/netlify`.
- Sentry OAuth: `/oauth/sentry`.
- Atlassian/Jira OAuth: `/oauth/atlassian` with the scopes recorded in the registry.
- Google OAuth callback: `/oauth/google`.
- Airtable hosted MCP: `https://mcp.airtable.com/mcp` (PAT-backed).
- Supabase hosted MCP: `https://mcp.supabase.com/mcp` scoped with `SUPABASE_PROJECT_REF`.

## Remote MCP gateway

After deployment, the gateway routes are:

- `POST /mcp/airtable`
- `POST /mcp/supabase?read_only=true`

The Airtable route reads `AIRTABLE_PAT` from Worker secrets. The Supabase route expects an authorized access token in `TOKENS_KV`; it does not invent credentials or store them in source control.

## Secrets

Never commit OAuth client secrets, PATs, access tokens, or refresh tokens. Use local `.dev.vars` for development and Cloudflare Worker secrets for production.

## Important implementation status

The connector registry and remote MCP proxy are implemented first. Provider-specific OAuth authorization/token callbacks remain explicit `501` placeholders until each provider's exact OAuth endpoints and token-storage flow are wired and tested. This prevents a connector from appearing to work when it has not actually been authenticated.
