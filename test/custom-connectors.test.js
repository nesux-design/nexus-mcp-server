import test from "node:test";
import assert from "node:assert/strict";
import {
  connectorInitial,
  connectorLogo,
  validateMcpUrl
} from "../src/mcp/custom-connectors.js";

test("custom connector initials use the first Unicode character", () => {
  assert.equal(connectorInitial("Vercel MCP"), "V");
  assert.equal(connectorInitial("  cloud tools"), "C");
  assert.equal(connectorInitial(""), "M");
});

test("custom connector logo prefers a secure explicit logo", () => {
  const result = connectorLogo("https://example.com/mcp", "https://cdn.example.com/logo.png");
  assert.equal(result.logoUrl, "https://cdn.example.com/logo.png");
  assert.equal(result.logoSource, "custom");
});

test("custom connector logo falls back to a domain favicon", () => {
  const result = connectorLogo("https://mcp.example.com/mcp");
  assert.match(result.logoUrl, /domain=mcp\.example\.com/);
  assert.equal(result.logoSource, "favicon");
});

test("custom MCP URLs remain HTTPS-only and reject private IPv4 ranges", () => {
  assert.equal(validateMcpUrl("http://example.com/mcp").ok, false);
  assert.equal(validateMcpUrl("https://127.0.0.1/mcp").ok, false);
  assert.equal(validateMcpUrl("https://10.0.0.5/mcp").ok, false);
  assert.equal(validateMcpUrl("https://example.com/mcp").ok, true);
});
