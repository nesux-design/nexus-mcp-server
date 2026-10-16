import test from "node:test";
import assert from "node:assert/strict";
import { CONNECTORS, publicConnectorList } from "../config/connectors.js";

test("registry exposes every NEXUS MCP provider", () => {
  const list = publicConnectorList();
  assert.deepEqual(
    list.map((item) => item.id).sort(),
    Object.entries(CONNECTORS).filter(([, item]) => item.mcp === true).map(([id]) => id).sort()
  );
  assert.ok(list.some((item) => item.id === "zoom"), "Zoom official MCP must be advertised");
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
  for (const id of Object.keys(CONNECTORS).filter((key) => CONNECTORS[key].mcp && !CONNECTORS[key].local)) {
    if (CONNECTORS[id].auth !== "bridge") assert.equal(typeof CONNECTORS[id].mcpUrl, "string", id);
  }
  for (const id of ["googleDrive", "googleCalendar", "github", "discord", "reddit", "mailchimp", "spotify", "twitch"]) {
    assert.equal(CONNECTORS[id].local, true, id);
  }
  assert.equal(CONNECTORS.zoom.auth, "upstream-oauth");
  assert.equal(CONNECTORS.zoom.mcpUrl, "https://mcp.zoom.us/mcp/zoom/streamable");
  assert.equal(CONNECTORS.zoom.pkce, true);
});

test("Atlassian connector uses the official upstream MCP endpoint", () => {
  assert.equal(CONNECTORS.atlassian.mcpUrl, "https://mcp.atlassian.com/v2/mcp");
  assert.equal(CONNECTORS.atlassian.auth, "upstream-oauth");
});
