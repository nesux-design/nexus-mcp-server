import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS, publicConnectorList } from "../config/connectors.js";

const REAL_MCP_URLS = {
  cloudflare: "https://mcp.cloudflare.com/mcp",
  vercel: "https://mcp.vercel.com",
  netlify: "https://netlify-mcp.netlify.app/mcp",
  atlassian: "https://mcp.atlassian.com/v1/mcp/authv2",
  googleDeveloperKnowledge: "https://developerknowledge.googleapis.com/mcp",
  airtable: "https://mcp.airtable.com/mcp",
  supabase: "https://mcp.supabase.com/mcp"
};

test("registry exposes only real remote MCP providers", () => {
  const list = publicConnectorList();
  assert.deepEqual(
    Object.fromEntries(list.map((item) => [item.id, item.mcpUrl])),
    REAL_MCP_URLS
  );
  assert.equal(list.some((item) => item.id === "sentry"), false);
  assert.equal(list.some((item) => item.id === "google"), false);
});

test("every advertised MCP connector has an upstream MCP URL", () => {
  for (const connector of Object.values(CONNECTORS).filter((item) => item.mcp)) {
    assert.equal(typeof connector.mcpUrl, "string");
    assert.match(connector.mcpUrl, /^https:\/\//);
  }
});

test("upstream OAuth connectors are never treated as local provider OAuth", () => {
  assert.equal(CONNECTORS.vercel.auth, "upstream-oauth");
  assert.equal(CONNECTORS.netlify.auth, "upstream-oauth");
  assert.equal(CONNECTORS.atlassian.auth, "upstream-oauth");
  assert.equal(CONNECTORS.supabase.auth, "upstream-oauth");
});

test("Atlassian uses the current MCP OAuth 2.1 authv2 endpoint", () => {
  assert.equal(CONNECTORS.atlassian.mcpUrl, "https://mcp.atlassian.com/v1/mcp/authv2");
  assert.match(CONNECTORS.atlassian.note, /OAuth 2\.1\/DCR/);
});
