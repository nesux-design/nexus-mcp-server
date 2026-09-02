import { getOAuthAccessToken } from "./proxy.js";

const AIRTABLE_API_BASE = "https://api.airtable.com/v0";

export class AirtableMcpServer {
  constructor(env) {
    this.env = env;
  }

  async getAuthToken(userId) {
    return await getOAuthAccessToken(this.env, "airtable", userId);
  }

  async apiCall(method, endpoint, authToken, body = null) {
    const options = {
      method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      }
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${AIRTABLE_API_BASE}${endpoint}`, options);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(`Airtable API error (${response.status}): ${JSON.stringify(data.error || data)}`);
    }
    return data;
  }

  async listBases(userId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Airtable" };
    try {
      const data = await this.apiCall("GET", "/meta/bases", token);
      return { bases: (data.bases || []).map(b => ({ id: b.id, name: b.name, permissionLevel: b.permissionLevel })) };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listTables(userId, baseId) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Airtable" };
    if (!baseId) return { error: "base_id is required" };
    try {
      const data = await this.apiCall("GET", `/meta/bases/${baseId}/tables`, token);
      return { tables: (data.tables || []).map(t => ({ id: t.id, name: t.name, primaryFieldId: t.primaryFieldId })) };
    } catch (err) {
      return { error: err.message };
    }
  }

  async listRecords(userId, baseId, tableId, maxRecords) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Airtable" };
    if (!baseId || !tableId) return { error: "base_id and table_id are required" };
    try {
      const params = new URLSearchParams();
      params.set("maxRecords", String(maxRecords || 20));
      const data = await this.apiCall("GET", `/${baseId}/${tableId}?${params.toString()}`, token);
      return { records: (data.records || []).map(r => ({ id: r.id, fields: r.fields, createdTime: r.createdTime })) };
    } catch (err) {
      return { error: err.message };
    }
  }

  async createRecord(userId, baseId, tableId, fields) {
    const token = await this.getAuthToken(userId);
    if (!token) return { error: "Not authorized with Airtable" };
    if (!baseId || !tableId || !fields) return { error: "base_id, table_id and fields are required" };
    try {
      const data = await this.apiCall("POST", `/${baseId}/${tableId}`, token, { fields });
      return { id: data.id, fields: data.fields, message: "Record created" };
    } catch (err) {
      return { error: err.message };
    }
  }

  async handleToolCall(toolName, args, userId) {
    switch (toolName) {
      case "list_bases":
        return await this.listBases(userId);
      case "list_tables":
        if (!args.base_id) return { error: "base_id is required" };
        return await this.listTables(userId, args.base_id);
      case "list_records":
        return await this.listRecords(userId, args.base_id, args.table_id, args.max_records);
      case "create_record":
        return await this.createRecord(userId, args.base_id, args.table_id, args.fields);
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  }

  getToolDefinitions() {
    return [
      { name: "list_bases", description: "List all Airtable bases accessible to the user", inputSchema: { type: "object", properties: {}, required: [] } },
      { name: "list_tables", description: "List tables in an Airtable base", inputSchema: { type: "object", properties: { base_id: { type: "string" } }, required: ["base_id"] } },
      { name: "list_records", description: "List records from a table", inputSchema: { type: "object", properties: { base_id: { type: "string" }, table_id: { type: "string" }, max_records: { type: "number" } }, required: ["base_id", "table_id"] } },
      { name: "create_record", description: "Create a record in a table", inputSchema: { type: "object", properties: { base_id: { type: "string" }, table_id: { type: "string" }, fields: { type: "object" } }, required: ["base_id", "table_id", "fields"] } }
    ];
  }
}
