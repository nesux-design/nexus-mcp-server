import test from "node:test";
import assert from "node:assert/strict";
import { handleOAuth } from "../src/oauth/routes.js";

test("Netlify uses provider-owned MCP OAuth instead of gateway OAuth exchange", async () => {
  const request = new Request("https://nexus.example.test/oauth/netlify", {
    headers: {
      "x-nexus-user-id": "user-123",
      "x-nexus-signature": "invalid"
    }
  });

  const env = { NEXUS_INTERNAL_AUTH_SECRET: "internal-secret" };
  const response = await handleOAuth(request, env, "/oauth/netlify");
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error, "upstream_mcp_oauth_required");
  assert.equal(body.provider, "netlify");
  assert.equal(body.mcpUrl, "https://netlify-mcp.netlify.app/mcp");
  assert.equal(body.tokenSync, "/internal/mcp-token/netlify");
});
