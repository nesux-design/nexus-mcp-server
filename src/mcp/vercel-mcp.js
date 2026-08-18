import { getOAuthAccessToken } from "./proxy.js";

const VERCEL_API_BASE = "https://api.vercel.com";

export class VercelMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "vercel", userId);
  }

  async vercelApiCall(method, endpoint, authToken, body = null) {
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

    const response = await fetch(`${VERCEL_API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Vercel API error: ${JSON.stringify(data.error || data)}`);
    }

    return data;
  }

  async listProjects(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Vercel" };

    try {
      const data = await this.vercelApiCall("GET", "/v9/projects", token);
      return {
        projects: (data.projects || []).map((p) => ({
          id: p.id,
          name: p.name,
          framework: p.framework,
          created_at: p.createdAt,
          updated_at: p.updatedAt
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listDeployments(userId, projectId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Vercel" };

    try {
      const endpoint = projectId
        ? `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=20`
        : "/v6/deployments?limit=20";
      const data = await this.vercelApiCall("GET", endpoint, token);
      return {
        deployments: (data.deployments || []).map((d) => ({
          uid: d.uid,
          name: d.name,
          url: d.url,
          state: d.state,
          created_at: d.created,
          target: d.target
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getProject(userId, projectId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Vercel" };

    try {
      const data = await this.vercelApiCall("GET", `/v9/projects/${encodeURIComponent(projectId)}`, token);
      return {
        id: data.id,
        name: data.name,
        framework: data.framework,
        created_at: data.createdAt,
        latest_deployments: (data.latestDeployments || []).map((d) => ({
          url: d.url,
          state: d.readyState
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listDomains(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Vercel" };

    try {
      const data = await this.vercelApiCall("GET", "/v5/domains", token);
      return {
        domains: (data.domains || []).map((d) => ({
          name: d.name,
          verified: d.verified,
          created_at: d.createdAt
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async createDeployment(userId, name, files) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Vercel" };

    try {
      const data = await this.vercelApiCall("POST", "/v13/deployments", token, {
        name,
        files: files || [],
        target: "production"
      });
      return {
        uid: data.id,
        url: data.url,
        state: data.readyState
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_projects":
        return await this.listProjects(userId);

      case "list_deployments":
        return await this.listDeployments(userId, args.project_id);

      case "get_project":
        if (!args.project_id) return { error: "project_id is required" };
        return await this.getProject(userId, args.project_id);

      case "list_domains":
        return await this.listDomains(userId);

      case "create_deployment":
        if (!args.name) return { error: "name is required" };
        return await this.createDeployment(userId, args.name, args.files);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "list_projects",
        description: "List all Vercel projects in your account",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "list_deployments",
        description: "List recent Vercel deployments, optionally filtered by project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Optional project ID to filter by" }
          },
          required: []
        }
      },
      {
        name: "get_project",
        description: "Get details about a specific Vercel project",
        inputSchema: {
          type: "object",
          properties: {
            project_id: { type: "string", description: "Project ID or name" }
          },
          required: ["project_id"]
        }
      },
      {
        name: "list_domains",
        description: "List all domains configured in your Vercel account",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "create_deployment",
        description: "Create a new Vercel deployment",
        inputSchema: {
          type: "object",
          properties: {
            name: { type: "string", description: "Deployment/project name" },
            files: { type: "array", description: "Array of file objects with file and data fields" }
          },
          required: ["name"]
        }
      }
    ];
  }
}
