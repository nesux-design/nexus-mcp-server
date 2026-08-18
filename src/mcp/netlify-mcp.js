import { getOAuthAccessToken } from "./proxy.js";

const NETLIFY_API_BASE = "https://api.netlify.com/api/v1";

export class NetlifyMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "netlify", userId);
  }

  async netlifyApiCall(method, endpoint, authToken, body = null) {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(`${NETLIFY_API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Netlify API error: ${JSON.stringify(data.message || data)}`);
    }

    return data;
  }

  async listSites(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };

    try {
      const data = await this.netlifyApiCall("GET", "/sites", token);
      return {
        sites: (data || []).map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          admin_url: s.admin_url,
          created_at: s.created_at,
          updated_at: s.updated_at,
          state: s.state
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getSite(userId, siteId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };

    try {
      const data = await this.netlifyApiCall("GET", `/sites/${encodeURIComponent(siteId)}`, token);
      return {
        id: data.id,
        name: data.name,
        url: data.url,
        admin_url: data.admin_url,
        build_settings: data.build_settings,
        state: data.state
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listDeploys(userId, siteId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };
    if (!siteId) return { error: "site_id is required" };

    try {
      const data = await this.netlifyApiCall("GET", `/sites/${encodeURIComponent(siteId)}/deploys`, token);
      return {
        deploys: (data || []).slice(0, 20).map((d) => ({
          id: d.id,
          state: d.state,
          url: d.deploy_url,
          created_at: d.created_at,
          branch: d.branch
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listEnvVars(userId, siteId, accountId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };
    if (!accountId) return { error: "account_id is required" };

    try {
      const params = new URLSearchParams();
      if (siteId) params.set("site_id", siteId);
      const data = await this.netlifyApiCall(
        "GET",
        `/accounts/${encodeURIComponent(accountId)}/env?${params.toString()}`,
        token
      );
      return {
        envVars: (data || []).map((e) => ({
          key: e.key,
          scopes: e.scopes,
          is_secret: e.is_secret
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listForms(userId, siteId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };
    if (!siteId) return { error: "site_id is required" };

    try {
      const data = await this.netlifyApiCall("GET", `/sites/${encodeURIComponent(siteId)}/forms`, token);
      return {
        forms: (data || []).map((f) => ({
          id: f.id,
          name: f.name,
          submission_count: f.submission_count
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getUser(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Netlify" };

    try {
      const data = await this.netlifyApiCall("GET", "/user", token);
      return {
        id: data.id,
        full_name: data.full_name,
        email: data.email
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_sites":
        return await this.listSites(userId);

      case "get_site":
        if (!args.site_id) return { error: "site_id is required" };
        return await this.getSite(userId, args.site_id);

      case "list_deploys":
        return await this.listDeploys(userId, args.site_id);

      case "list_env_vars":
        return await this.listEnvVars(userId, args.site_id, args.account_id);

      case "list_forms":
        return await this.listForms(userId, args.site_id);

      case "get_user":
        return await this.getUser(userId);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "list_sites",
        description: "List all Netlify sites in your account",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "get_site",
        description: "Get details about a specific Netlify site",
        inputSchema: {
          type: "object",
          properties: {
            site_id: { type: "string", description: "Site ID or site name" }
          },
          required: ["site_id"]
        }
      },
      {
        name: "list_deploys",
        description: "List recent deploys for a Netlify site",
        inputSchema: {
          type: "object",
          properties: {
            site_id: { type: "string", description: "Site ID" }
          },
          required: ["site_id"]
        }
      },
      {
        name: "list_env_vars",
        description: "List environment variables for a Netlify account/site",
        inputSchema: {
          type: "object",
          properties: {
            account_id: { type: "string", description: "Netlify account (team) ID" },
            site_id: { type: "string", description: "Optional site ID to scope env vars" }
          },
          required: ["account_id"]
        }
      },
      {
        name: "list_forms",
        description: "List forms submitted on a Netlify site",
        inputSchema: {
          type: "object",
          properties: {
            site_id: { type: "string", description: "Site ID" }
          },
          required: ["site_id"]
        }
      },
      {
        name: "get_user",
        description: "Get information about the authenticated Netlify user",
        inputSchema: { type: "object", properties: {}, required: [] }
      }
    ];
  }
}
