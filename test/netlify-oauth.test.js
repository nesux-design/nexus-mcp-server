import test from "node:test";
import assert from "node:assert/strict";
import { exchangeCode } from "../src/oauth/oauth2.js";

test("Netlify OAuth exchanges authorization codes against the production token endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedRequest;

  globalThis.fetch = async (url, options) => {
    capturedRequest = { url: String(url), options };
    return new Response(JSON.stringify({ access_token: "test-access-token", token_type: "bearer" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  try {
    const request = new Request("https://nexus.example.test/oauth/netlify");
    const env = {
      NETLIFY_CLIENT_ID: "netlify-client-id",
      NETLIFY_CLIENT_SECRET: "netlify-client-secret"
    };

    const tokens = await exchangeCode(request, env, "netlify", "authorization-code");

    assert.equal(tokens.access_token, "test-access-token");
    assert.equal(capturedRequest.url, "https://api.netlify.com/oauth/token");
    assert.equal(capturedRequest.options.method, "POST");
    assert.equal(capturedRequest.options.headers["content-type"], "application/x-www-form-urlencoded");

    const body = new URLSearchParams(capturedRequest.options.body);
    assert.equal(body.get("grant_type"), "authorization_code");
    assert.equal(body.get("code"), "authorization-code");
    assert.equal(body.get("client_id"), "netlify-client-id");
    assert.equal(body.get("client_secret"), "netlify-client-secret");
    assert.equal(body.get("redirect_uri"), "https://nexus.example.test/oauth/netlify");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
