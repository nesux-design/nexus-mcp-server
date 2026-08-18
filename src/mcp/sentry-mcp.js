import { getOAuthAccessToken } from "./proxy.js";

const SENTRY_API_BASE = "https://sentry.io/api/0";

export class SentryMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "sentry", userId);
  }

  async sentryApiCall(method, endpoint, authToken, body = null) {
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

    const response = await fetch(`${SENTRY_API_BASE}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Sentry API error (${response.status}): ${JSON.stringify(data.detail || data)}`);
    }

    return data;
  }

  async listOrganizations(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Sentry" };

    try {
      const data = await this.sentryApiCall("GET", "/organizations/", token);
      return {
        organizations: (data || []).map((o) => ({
          id: o.id,
          slug: o.slug,
          name: o.name
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listProjects(userId, orgSlug) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Sentry" };

    try {
      const endpoint = orgSlug ? `/organizations/${encodeURIComponent(orgSlug)}/projects/` : "/projects/";
      const data = await this.sentryApiCall("GET", endpoint, token);
      return {
        projects: (data || []).map((p) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          platform: p.platform
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listIssues(userId, orgSlug, projectSlug, query) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Sentry" };
    if (!orgSlug || !projectSlug) return { error: "org_slug and project_slug are required" };

    try {
      const params = new URLSearchParams();
      if (query) params.set("query", query);
      const data = await this.sentryApiCall(
        "GET",
        `/projects/${encodeURIComponent(orgSlug)}/${encodeURIComponent(projectSlug)}/issues/?${params.toString()}`,
        token
      );
      return {
        issues: (data || []).slice(0, 25).map((i) => ({
          id: i.id,
          title: i.title,
          culprit: i.culprit,
          level: i.level,
          status: i.status,
          count: i.count,
          firstSeen: i.firstSeen,
          lastSeen: i.lastSeen
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getIssue(userId, issueId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Sentry" };

    try {
      const data = await this.sentryApiCall("GET", `/issues/${encodeURIComponent(issueId)}/`, token);
      return {
        id: data.id,
        title: data.title,
        culprit: data.culprit,
        level: data.level,
        status: data.status,
        count: data.count,
        metadata: data.metadata
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listReleases(userId, orgSlug) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Sentry" };
    if (!orgSlug) return { error: "org_slug is required" };

    try {
      const data = await this.sentryApiCall(
        "GET",
        `/organizations/${encodeURIComponent(orgSlug)}/releases/`,
        token
      );
      return {
        releases: (data || []).slice(0, 20).map((r) => ({
          version: r.version,
          dateCreated: r.dateCreated,
          dateReleased: r.dateReleased,
          newGroups: r.newGroups
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_organizations":
        return await this.listOrganizations(userId);

      case "list_projects":
        return await this.listProjects(userId, args.org_slug);

      case "list_issues":
        return await this.listIssues(userId, args.org_slug, args.project_slug, args.query);

      case "get_issue":
        if (!args.issue_id) return { error: "issue_id is required" };
        return await this.getIssue(userId, args.issue_id);

      case "list_releases":
        return await this.listReleases(userId, args.org_slug);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "list_organizations",
        description: "List all Sentry organizations accessible to the user",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "list_projects",
        description: "List Sentry projects, optionally scoped to an organization",
        inputSchema: {
          type: "object",
          properties: {
            org_slug: { type: "string", description: "Organization slug (optional)" }
          },
          required: []
        }
      },
      {
        name: "list_issues",
        description: "List issues for a specific Sentry project",
        inputSchema: {
          type: "object",
          properties: {
            org_slug: { type: "string", description: "Organization slug" },
            project_slug: { type: "string", description: "Project slug" },
            query: { type: "string", description: "Optional search query, e.g. 'is:unresolved'" }
          },
          required: ["org_slug", "project_slug"]
        }
      },
      {
        name: "get_issue",
        description: "Get details of a specific Sentry issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_id: { type: "string", description: "Issue ID" }
          },
          required: ["issue_id"]
        }
      },
      {
        name: "list_releases",
        description: "List releases for a Sentry organization",
        inputSchema: {
          type: "object",
          properties: {
            org_slug: { type: "string", description: "Organization slug" }
          },
          required: ["org_slug"]
        }
      }
    ];
  }
}
