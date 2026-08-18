import { getOAuthAccessToken } from "./proxy.js";

const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

export class CloudflareMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "cloudflare", userId);
  }

  async cfApiCall(method, endpoint, authToken, body = null) {
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

    const response = await fetch(`${CLOUDFLARE_API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors?.[0] || data)}`);
    }

    return data.result;
  }

  async listWorkers(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { workers: [] };
      }

      const accountId = accounts[0].id;
      const workers = await this.cfApiCall(
        "GET",
        `/accounts/${accountId}/workers/scripts`,
        token
      );

      return {
        workers: workers.map((w) => ({
          name: w.main?.name || "unknown",
          created_on: w.created_on,
          modified_on: w.modified_on,
          deployment_id: w.id
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listKvNamespaces(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { namespaces: [] };
      }

      const accountId = accounts[0].id;
      const namespaces = await this.cfApiCall(
        "GET",
        `/accounts/${accountId}/storage/kv/namespaces`,
        token
      );

      return {
        namespaces: namespaces.map((ns) => ({
          id: ns.id,
          name: ns.title,
          created_on: ns.created_on
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async readKv(userId, namespaceId, key) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { error: "No Cloudflare account found" };
      }

      const accountId = accounts[0].id;
      const value = await this.cfApiCall(
        "GET",
        `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
        token
      );

      return { key, value };
    } catch (err) {
      return { error: err.message };
    }
  }

  async writeKv(userId, namespaceId, key, value) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { error: "No Cloudflare account found" };
      }

      const accountId = accounts[0].id;

      // Cloudflare KV PUT uses form data
      const formData = new FormData();
      formData.append("value", value);

      const response = await fetch(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/values/${encodeURIComponent(key)}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json"
          },
          body: formData
        }
      );

      const data = await response.json();
      if (!data.success) {
        throw new Error(`Cloudflare API error: ${JSON.stringify(data.errors?.[0] || data)}`);
      }

      return { success: true, key, message: "Value written to KV" };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listDatabases(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { databases: [] };
      }

      const accountId = accounts[0].id;
      const databases = await this.cfApiCall(
        "GET",
        `/accounts/${accountId}/d1/database`,
        token
      );

      return {
        databases: (databases || []).map((db) => ({
          id: db.id,
          name: db.name,
          created_at: db.created_at
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listR2Buckets(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { buckets: [] };
      }

      const accountId = accounts[0].id;
      const buckets = await this.cfApiCall(
        "GET",
        `/accounts/${accountId}/r2/buckets`,
        token
      );

      return {
        buckets: buckets.map((b) => ({
          name: b.name,
          creation_date: b.creation_date
        }))
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async getAccountInfo(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Cloudflare" };

    try {
      const accounts = await this.cfApiCall("GET", "/accounts", token);
      if (!Array.isArray(accounts) || accounts.length === 0) {
        return { error: "No Cloudflare account found" };
      }

      const account = accounts[0];
      return {
        id: account.id,
        name: account.name,
        type: account.type,
        plan: account.plan?.name || "unknown"
      };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_workers":
        return await this.listWorkers(userId);

      case "list_kv_namespaces":
        return await this.listKvNamespaces(userId);

      case "read_kv":
        if (!args.namespace_id || !args.key) {
          return { error: "namespace_id and key are required" };
        }
        return await this.readKv(userId, args.namespace_id, args.key);

      case "write_kv":
        if (!args.namespace_id || !args.key || !args.value) {
          return { error: "namespace_id, key, and value are required" };
        }
        return await this.writeKv(userId, args.namespace_id, args.key, args.value);

      case "list_databases":
        return await this.listDatabases(userId);

      case "list_r2_buckets":
        return await this.listR2Buckets(userId);

      case "get_account_info":
        return await this.getAccountInfo(userId);

      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      {
        name: "list_workers",
        description: "List all Cloudflare Workers scripts in your account",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "list_kv_namespaces",
        description: "List all Cloudflare KV namespaces in your account",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "read_kv",
        description: "Read a value from a Cloudflare KV namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace_id: { type: "string", description: "KV Namespace ID" },
            key: { type: "string", description: "Key to read" }
          },
          required: ["namespace_id", "key"]
        }
      },
      {
        name: "write_kv",
        description: "Write a value to a Cloudflare KV namespace",
        inputSchema: {
          type: "object",
          properties: {
            namespace_id: { type: "string", description: "KV Namespace ID" },
            key: { type: "string", description: "Key to write" },
            value: { type: "string", description: "Value to write" }
          },
          required: ["namespace_id", "key", "value"]
        }
      },
      {
        name: "list_databases",
        description: "List all Cloudflare D1 databases in your account",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "list_r2_buckets",
        description: "List all Cloudflare R2 buckets in your account",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_account_info",
        description: "Get information about your Cloudflare account",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      }
    ];
  }
}
