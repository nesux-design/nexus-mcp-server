import test from "node:test";
import assert from "node:assert/strict";
import { handleOAuth } from "../src/oauth/routes.js";

test("Netlify gateway OAuth remains protected by internal authentication", async () => {
  const request = new Request("https://nexus.example.test/oauth/netlify", {
    headers: {
      "x-nexus-user-id": "user-123",
      "x-nexus-signature": "invalid"
    }
  });

  const env = { NEXUS_INTERNAL_AUTH_SECRET: "internal-secret" };
  const response = await handleOAuth(request, env, "/oauth/netlify");
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.error, "Unauthorized");
});
