import { getOAuthAccessToken } from "./proxy.js";

const ATLASSIAN_API_BASE = "https://api.atlassian.com";

export class AtlassianMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "atlassian", userId);
  }

  async atlassianApiCall(method, url, authToken, body = null) {
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

    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Atlassian API error (${response.status}): ${JSON.stringify(data.errorMessages || data)}`);
    }

    return data;
  }

  async getCloudId(userId, authToken) {
    const resources = await this.atlassianApiCall(
      "GET",
      `${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`,
      authToken
    );
    if (!Array.isArray(resources) || resources.length === 0) {
      throw new Error("No accessible Atlassian sites found for this user");
    }
    return resources[0].id;
  }

  async listProjects(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Atlassian" };

    try {
      const cloudId = await this.getCloudId(userId, token);
      const data = await this.atlassianApiCall(
        "GET",
        `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/project/search`,
        token
      );
      return {
        projects: (data.values || []).map((p) => ({
          id: p.id,
          key: p.key,
          name: p.name,
          projectTypeKey: p.projectTypeKey
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async searchIssues(userId, jql, maxResults) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Atlassian" };

    try {
      const cloudId = await this.getCloudId(userId, token);
      const params = new URLSearchParams();
      params.set("jql", jql || "");
      params.set("maxResults", String(maxResults || 20));

      const data = await this.atlassianApiCall(
        "GET",
        `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/search?${params.toString()}`,
        token
      );
      return {
        issues: (data.issues || []).map((i) => ({
          key: i.key,
          summary: i.fields?.summary,
          status: i.fields?.status?.name,
          assignee: i.fields?.assignee?.displayName,
          priority: i.fields?.priority?.name
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getIssue(userId, issueKey) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Atlassian" };

    try {
      const cloudId = await this.getCloudId(userId, token);
      const data = await this.atlassianApiCall(
        "GET",
        `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue/${encodeURIComponent(issueKey)}`,
        token
      );
      return {
        key: data.key,
        summary: data.fields?.summary,
        description: data.fields?.description,
        status: data.fields?.status?.name,
        assignee: data.fields?.assignee?.displayName,
        reporter: data.fields?.reporter?.displayName,
        priority: data.fields?.priority?.name,
        created: data.fields?.created
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async createIssue(userId, projectKey, summary, description, issueType) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Atlassian" };

    try {
      const cloudId = await this.getCloudId(userId, token);
      const data = await this.atlassianApiCall(
        "POST",
        `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3/issue`,
        token,
        {
          fields: {
            project: { key: projectKey },
            summary,
            description: {
              type: "doc",
              version: 1,
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: description || "" }]
                }
              ]
            },
            issuetype: { name: issueType || "Task" }
          }
        }
      );
      return {
        id: data.id,
        key: data.key,
        message: "Issue created successfully"
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listAccessibleSites(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Atlassian" };

    try {
      const resources = await this.atlassianApiCall(
        "GET",
        `${ATLASSIAN_API_BASE}/oauth/token/accessible-resources`,
        token
      );
      return {
        sites: (resources || []).map((r) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          scopes: r.scopes
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_projects":
        return await this.listProjects(userId);

      case "search_issues":
        if (!args.jql) return { error: "jql is required" };
        return await this.searchIssues(userId, args.jql, args.max_results);

      case "get_issue":
        if (!args.issue_key) return { error: "issue_key is required" };
        return await this.getIssue(userId, args.issue_key);

      case "create_issue":
        if (!args.project_key || !args.summary) {
          return { error: "project_key and summary are required" };
        }
        return await this.createIssue(
          userId,
          args.project_key,
          args.summary,
          args.description,
          args.issue_type
        );

      case "list_accessible_sites":
        return await this.listAccessibleSites(userId);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "list_projects",
        description: "List all Jira projects accessible to the user",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "search_issues",
        description: "Search Jira issues using JQL (Jira Query Language)",
        inputSchema: {
          type: "object",
          properties: {
            jql: { type: "string", description: "JQL query string, e.g. 'project = ABC AND status = Open'" },
            max_results: { type: "number", description: "Maximum number of results (default 20)" }
          },
          required: ["jql"]
        }
      },
      {
        name: "get_issue",
        description: "Get details of a specific Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            issue_key: { type: "string", description: "Issue key, e.g. 'PROJ-123'" }
          },
          required: ["issue_key"]
        }
      },
      {
        name: "create_issue",
        description: "Create a new Jira issue",
        inputSchema: {
          type: "object",
          properties: {
            project_key: { type: "string", description: "Project key, e.g. 'PROJ'" },
            summary: { type: "string", description: "Issue summary/title" },
            description: { type: "string", description: "Issue description" },
            issue_type: { type: "string", description: "Issue type, e.g. 'Task', 'Bug', 'Story' (default Task)" }
          },
          required: ["project_key", "summary"]
        }
      },
      {
        name: "list_accessible_sites",
        description: "List Atlassian sites (Jira instances) accessible to the user",
        inputSchema: { type: "object", properties: {}, required: [] }
      }
    ];
  }
}
