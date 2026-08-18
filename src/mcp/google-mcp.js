import { getOAuthAccessToken } from "./proxy.js";

const GOOGLE_API_BASE = "https://www.googleapis.com";

export class GoogleMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "google", userId);
  }

  async googleApiCall(method, url, authToken) {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json"
      }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(`Google API error (${response.status}): ${JSON.stringify(data.error?.message || data)}`);
    }

    return data;
  }

  async getUserInfo(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Google" };

    try {
      const data = await this.googleApiCall(
        "GET",
        `${GOOGLE_API_BASE}/oauth2/v2/userinfo`,
        token
      );
      return {
        id: data.id,
        email: data.email,
        name: data.name,
        picture: data.picture
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listDriveFiles(userId, query, maxResults) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Google" };

    try {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      params.set("pageSize", String(maxResults || 20));
      params.set("fields", "files(id,name,mimeType,modifiedTime,webViewLink)");

      const data = await this.googleApiCall(
        "GET",
        `${GOOGLE_API_BASE}/drive/v3/files?${params.toString()}`,
        token
      );
      return {
        files: (data.files || []).map((f) => ({
          id: f.id,
          name: f.name,
          mimeType: f.mimeType,
          modifiedTime: f.modifiedTime,
          link: f.webViewLink
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async searchDriveFiles(userId, searchTerm) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Google" };
    if (!searchTerm) return { error: "search_term is required" };

    try {
      const query = `name contains '${searchTerm.replace(/'/g, "\\'")}'`;
      return await this.listDriveFiles(userId, query, 20);
    } catch (err) {
      return { error: err.message };
    }
  }

  async getDriveFile(userId, fileId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Google" };
    if (!fileId) return { error: "file_id is required" };

    try {
      const params = new URLSearchParams();
      params.set("fields", "id,name,mimeType,modifiedTime,webViewLink,size,owners");

      const data = await this.googleApiCall(
        "GET",
        `${GOOGLE_API_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?${params.toString()}`,
        token
      );
      return {
        id: data.id,
        name: data.name,
        mimeType: data.mimeType,
        modifiedTime: data.modifiedTime,
        link: data.webViewLink,
        size: data.size,
        owners: (data.owners || []).map((o) => o.displayName)
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "get_user_info":
        return await this.getUserInfo(userId);

      case "list_drive_files":
        return await this.listDriveFiles(userId, args.query, args.max_results);

      case "search_drive_files":
        if (!args.search_term) return { error: "search_term is required" };
        return await this.searchDriveFiles(userId, args.search_term);

      case "get_drive_file":
        if (!args.file_id) return { error: "file_id is required" };
        return await this.getDriveFile(userId, args.file_id);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "get_user_info",
        description: "Get information about the authenticated Google user",
        inputSchema: { type: "object", properties: {}, required: [] }
      },
      {
        name: "list_drive_files",
        description: "List files in the user's Google Drive",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "Optional Google Drive query string" },
            max_results: { type: "number", description: "Maximum number of results (default 20)" }
          },
          required: []
        }
      },
      {
        name: "search_drive_files",
        description: "Search Google Drive files by name",
        inputSchema: {
          type: "object",
          properties: {
            search_term: { type: "string", description: "Text to search for in file names" }
          },
          required: ["search_term"]
        }
      },
      {
        name: "get_drive_file",
        description: "Get details about a specific Google Drive file",
        inputSchema: {
          type: "object",
          properties: {
            file_id: { type: "string", description: "Google Drive file ID" }
          },
          required: ["file_id"]
        }
      }
    ];
  }
}
