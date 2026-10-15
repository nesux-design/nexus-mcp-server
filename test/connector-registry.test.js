import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS, publicConnectorList } from "../config/connectors.js";

const EXPECTED_MCP_PROVIDERS = [
  "cloudflare",
  "vercel",
  "netlify",
  "atlassian",
  "googleDeveloperKnowledge",
  "airtable",
  "supabase",
  "sentry",
  "google"
];

test("registry exposes every NEXUS MCP provider", () => {
  const list = publicConnectorList();
  assert.deepEqual(
    list.map((item) => item.id).sort(),
    [...EXPECTED_MCP_PROVIDERS].sort()
  );
  for (const item of list) assert.equal(CONNECTORS[item.id].mcp, true);
});

test("every advertised MCP connector has either a local adapter or an upstream MCP URL", () => {
  for (const [id, connector] of Object.entries(CONNECTORS).filter(([, item]) => item.mcp)) {
    assert.equal(
      Boolean(connector.local) || typeof connector.mcpUrl === "string",
      true,
      `${id} must declare local MCP support or an upstream MCP URL`
    );
  }
});

test("MCP providers are explicitly classified as local adapters or upstream MCP endpoints", () => {
  for (const id of ["cloudflare", "googleDeveloperKnowledge", "supabase"]) {
    assert.equal(typeof CONNECTORS[id].mcpUrl, "string");
  }
  for (const id of ["vercel", "netlify", "atlassian", "airtable", "sentry", "google"]) {
    assert.equal(CONNECTORS[id].local, true);
  }
});

test("Google Drive routes through the official hosted MCP instead of the local adapter", () => {
  assert.equal(CONNECTORS.googleDrive.local, undefined);
  assert.equal(CONNECTORS.googleDrive.mcpUrl, "https://drivemcp.googleapis.com/mcp/v1");
  assert.equal(CONNECTORS.googleDrive.auth, "oauth2");
  assert.equal(CONNECTORS.googleDrive.callback, "/oauth/googleDrive/callback");
  assert.deepEqual(CONNECTORS.googleDrive.scopes, [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/drive.file"
  ]);
});

test("Atlassian connector has an explicit MCP OAuth callback route", () => {
  assert.equal(CONNECTORS.atlassian.callback, "/oauth/atlassian");
  assert.equal(CONNECTORS.atlassian.auth, "oauth2");
});
