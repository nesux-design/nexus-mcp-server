# Real Per-User MCP — All Providers

Every provider below is a **local MCP server** running inside `nexus-mcp-server`.
Each authenticated NEXUS user connects **their own account** via OAuth; the
worker stores their token (encrypted, in KV) and uses it to call that
provider's real REST API directly. No shared/global credentials, no PAT
substituting for a real user identity — every call is scoped to the person
who authorized it.

## Providers Implemented

| Provider | Auth Type | Backing API | Routes |
|---|---|---|---|
| Cloudflare | oauth2 | api.cloudflare.com/client/v4 | `/cloudflare/tools`, `/cloudflare/call` |
| Vercel | oauth2 | api.vercel.com | `/vercel/tools`, `/vercel/call` |
| Netlify | oauth2 | api.netlify.com/api/v1 | `/netlify/tools`, `/netlify/call` |
| Atlassian (Jira) | oauth2 | api.atlassian.com (Jira Cloud REST v3) | `/atlassian/tools`, `/atlassian/call` |
| Sentry | oauth2 | sentry.io/api/0 | `/sentry/tools`, `/sentry/call` |
| Google | oauth2 | www.googleapis.com | `/google/tools`, `/google/call` |

All six use the exact same request/response shape (see below), so your main
Nexus chatbot worker (`nexus-a1`) only needs one small helper function to
call any of them.

## Setup (per provider)

For **each** provider, you need an OAuth app with the **redirect URI**:
```
https://nexus-mcp-server.apikeyakhilka.workers.dev/oauth/<provider>
```
(exact provider path: `cloudflare`, `vercel`, `netlify`, `atlassian`, `sentry`, `google`)

Then set the matching secrets (these env var names are already wired into
`config/connectors.js` — use exactly these names):

```bash
npx wrangler secret put CLOUDFLARE_CLIENT_ID
npx wrangler secret put CLOUDFLARE_CLIENT_SECRET

npx wrangler secret put VERCEL_CLIENT_ID
npx wrangler secret put VERCEL_CLIENT_SECRET

npx wrangler secret put NETLIFY_CLIENT_ID
npx wrangler secret put NETLIFY_CLIENT_SECRET

npx wrangler secret put ATLASSIAN_CLIENT_ID
npx wrangler secret put ATLASSIAN_CLIENT_SECRET

npx wrangler secret put SENTRY_CLIENT_ID
npx wrangler secret put SENTRY_CLIENT_SECRET

npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

Deploy:
```bash
npx wrangler deploy
```

**Tip:** to avoid whitespace/newline corruption when pasting secrets, use:
```bash
printf '%s' 'your-client-id-here' | npx wrangler secret put VERCEL_CLIENT_ID
```

### Scopes already configured (unchanged from your original setup)

- **Cloudflare** — d1, vectorize, workers-kv-storage, workers-r2,
  workers-scripts, workers-tail, account-settings, user-details, offline_access
- **Atlassian** — read:jira-user, read:jira-work, write:jira-work,
  manage:jira-project, manage:jira-webhook, offline_access
- **Sentry** — org:read, project:read, project:write, event:read, team:read
- **Google** — userinfo.email, userinfo.profile, drive.readonly
- **Vercel / Netlify** — no `scope` parameter is used by these providers;
  access is granted based on what your OAuth app is approved for when the
  user installs/authorizes it (this matches how their dashboards work).

## Authorization Flow (same for every provider)

```bash
NEXUS_SECRET='<your NEXUS_INTERNAL_AUTH_SECRET>'
NEXUS_USER_ID='user_123'
SIGNATURE=$(printf '%s' "$NEXUS_USER_ID" | openssl dgst -sha256 -hmac "$NEXUS_SECRET" -hex | sed 's/^.* //')

curl -i "https://nexus-mcp-server.apikeyakhilka.workers.dev/oauth/<provider>" \
  -H "X-Nexus-User-Id: $NEXUS_USER_ID" \
  -H "X-Nexus-Signature: $SIGNATURE"
```

This returns a `302` with a `location` header. Open that URL in a browser,
the user authorizes, and the worker stores their encrypted token in KV under
`oauth:<provider>:<userId>`.

## Calling Tools (same shape for every provider)

### List available tools
```bash
curl -X POST "https://nexus-mcp-server.apikeyakhilka.workers.dev/<provider>/tools" \
  -H "X-Nexus-User-Id: user_123" \
  -H "X-Nexus-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Call a tool
```bash
curl -X POST "https://nexus-mcp-server.apikeyakhilka.workers.dev/<provider>/call" \
  -H "X-Nexus-User-Id: user_123" \
  -H "X-Nexus-Signature: $SIGNATURE" \
  -H "Content-Type: application/json" \
  -d '{"tool":"<tool_name>","arguments":{...}}'
```

Response shape:
```json
{ "tool": "<tool_name>", "result": { ...provider-specific data... } }
```

If the user hasn't authorized that provider yet, `result` will be:
```json
{ "error": "Not authorized with <Provider>" }
```

## Tools Reference

### Cloudflare (`/cloudflare/*`)
- `list_workers` — list Workers scripts
- `list_kv_namespaces` — list KV namespaces
- `read_kv` (`namespace_id`, `key`) — read a KV value
- `write_kv` (`namespace_id`, `key`, `value`) — write a KV value
- `list_databases` — list D1 databases
- `list_r2_buckets` — list R2 buckets
- `get_account_info` — account details

### Vercel (`/vercel/*`)
- `list_projects` — list projects
- `list_deployments` (`project_id?`) — recent deployments
- `get_project` (`project_id`) — project details
- `list_domains` — configured domains
- `create_deployment` (`name`, `files?`) — trigger a deployment

### Netlify (`/netlify/*`)
- `list_sites` — list sites
- `get_site` (`site_id`) — site details
- `list_deploys` (`site_id`) — recent deploys
- `list_env_vars` (`account_id`, `site_id?`) — environment variables
- `list_forms` (`site_id`) — submitted forms
- `get_user` — authenticated user info

### Atlassian / Jira (`/atlassian/*`)
- `list_projects` — list Jira projects
- `search_issues` (`jql`, `max_results?`) — JQL search
- `get_issue` (`issue_key`) — issue details
- `create_issue` (`project_key`, `summary`, `description?`, `issue_type?`) — create an issue
- `list_accessible_sites` — Atlassian sites the user can access

### Sentry (`/sentry/*`)
- `list_organizations` — list orgs
- `list_projects` (`org_slug?`) — list projects
- `list_issues` (`org_slug`, `project_slug`, `query?`) — list issues
- `get_issue` (`issue_id`) — issue details
- `list_releases` (`org_slug`) — list releases

### Google (`/google/*`)
- `get_user_info` — authenticated user profile
- `list_drive_files` (`query?`, `max_results?`) — list Drive files
- `search_drive_files` (`search_term`) — search Drive by filename
- `get_drive_file` (`file_id`) — file details

## Integrating with nexus-a1 (main chatbot)

One generic helper covers every provider:

```js
async function callNexusMcp(provider, toolName, args, userId, secret) {
  const signature = await hmacSign(userId, secret); // same HMAC-SHA256 as before

  const response = await fetch(
    `https://nexus-mcp-server.apikeyakhilka.workers.dev/${provider}/call`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Nexus-User-Id": userId,
        "X-Nexus-Signature": signature
      },
      body: JSON.stringify({ tool: toolName, arguments: args })
    }
  );

  return await response.json();
}

// Example
const result = await callNexusMcp("vercel", "list_deployments", {}, "user_123", NEXUS_SECRET);
```

## Security

- Every `/<provider>/tools` and `/<provider>/call` route requires a valid
  `X-Nexus-User-Id` + `X-Nexus-Signature` (HMAC-SHA256 using
  `NEXUS_INTERNAL_AUTH_SECRET`) — same mechanism as the OAuth start routes.
- Tokens are AES-GCM encrypted at rest in KV, keyed per provider + user.
- Access tokens are auto-refreshed (via `getOAuthAccessToken` in `proxy.js`)
  when a `refresh_token` is available and the current token is near expiry.
- No token is ever returned to the caller — only the provider's data.

## Troubleshooting

**"Not authorized with `<Provider>`"** — the user hasn't completed
`/oauth/<provider>` yet, or their token was never saved. Re-run the
authorization flow.

**"`<Provider>` OAuth credentials are not configured"** — the matching
`*_CLIENT_ID` / `*_CLIENT_SECRET` secret isn't set. Run `wrangler secret put`.

**`invalid_client` during token exchange** — almost always a copy/paste
issue (extra whitespace/newline) when setting the secret, or the redirect
URI registered in the provider's dashboard doesn't exactly match
`https://nexus-mcp-server.apikeyakhilka.workers.dev/oauth/<provider>`.
Use `printf '%s' '...' | npx wrangler secret put ...` to avoid whitespace
issues.

**401 Unauthorized on `/tools` or `/call`** — signature mismatch. Confirm
`NEXUS_INTERNAL_AUTH_SECRET` used to sign the request matches what's set on
the worker, and that the signed payload is exactly the `userId` string.
