import test from "node:test";
import assert from "node:assert/strict";
import { handleMcpAuthorize } from "../src/mcp/oauth-authorization.js";
import { handleMcpToken } from "../src/mcp/oauth-token.js";

async function sign(secret, value) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function kvStore({ failPut = false } = {}) {
  const map = new Map();
  return {
    async put(key, value) {
      if (failPut) throw new Error("simulated KV failure");
      map.set(key, value);
    },
    async get(key) { return map.get(key) ?? null; },
    async delete(key) { map.delete(key); }
  };
}

function baseAuthorizeUrl() {
  const url = new URL("https://mcp.example/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", "client-1");
  url.searchParams.set("redirect_uri", "https://client.example/callback");
  url.searchParams.set("state", "state-1");
  url.searchParams.set("code_challenge", "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~");
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("resource", "https://mcp.example/mcp/vercel");
  url.searchParams.set("scope", "mcp");
  return url;
}

async function authorizedRequest(kv, overrides = {}) {
  const secret = "secret";
  const exp = String(Math.floor(Date.now() / 1000) + 120);
  const userId = overrides.userId || "user-123";
  const signature = await sign(secret, `${userId}.${exp}`);
  return handleMcpAuthorize(new Request(overrides.url || baseAuthorizeUrl(), {
    headers: {
      "x-nexus-user-id": userId,
      "x-nexus-user-exp": exp,
      "x-nexus-signature": signature
    }
  }), {
    TOKENS_KV: kv,
    NEXUS_INTERNAL_AUTH_SECRET: secret,
    MCP_TRUSTED_CLIENT_ID: "client-1",
    MCP_TRUSTED_CLIENT_REDIRECT_URI: "https://client.example/callback"
  });
}

test("MCP authorization rejects missing trusted NEXUS identity", async () => {
  const response = await handleMcpAuthorize(new Request("https://mcp.example/oauth/authorize"), {
    TOKENS_KV: kvStore(),
    NEXUS_INTERNAL_AUTH_SECRET: "secret",
    MCP_TRUSTED_CLIENT_ID: "client-1",
    MCP_TRUSTED_CLIENT_REDIRECT_URI: "https://client.example/callback"
  });
  assert.equal(response.status, 400);
});

test("MCP authorization creates a PKCE-bound per-user code and returns issuer", async () => {
  const kv = kvStore();
  const response = await authorizedRequest(kv, { userId: "user-456" });

  assert.equal(response.status, 302);
  const location = new URL(response.headers.get("location"));
  assert.equal(location.origin, "https://client.example");
  assert.equal(location.searchParams.get("state"), "state-1");
  assert.equal(location.searchParams.get("iss"), "https://mcp.example/oauth");
  assert.ok(location.searchParams.get("code"));
});

test("MCP authorization returns 503 when OAuth storage is unavailable", async () => {
  const response = await authorizedRequest(kvStore({ failPut: true }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "server_error");
});

test("MCP authorization returns 503 when TOKENS_KV is not configured", async () => {
  const secret = "secret";
  const exp = String(Math.floor(Date.now() / 1000) + 120);
  const userId = "user-123";
  const signature = await sign(secret, `${userId}.${exp}`);
  const response = await handleMcpAuthorize(new Request(baseAuthorizeUrl(), {
    headers: {
      "x-nexus-user-id": userId,
      "x-nexus-user-exp": exp,
      "x-nexus-signature": signature
    }
  }), {
    NEXUS_INTERNAL_AUTH_SECRET: secret,
    MCP_TRUSTED_CLIENT_ID: "client-1",
    MCP_TRUSTED_CLIENT_REDIRECT_URI: "https://client.example/callback"
  });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "server_error");
});

test("MCP token endpoint enforces redirect URI and resource", async () => {
  const kv = kvStore();
  const code = "placeholder-code";
  const tokenRequest = new Request("https://mcp.example/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: "client-1",
      redirect_uri: "https://wrong.example/callback",
      resource: "https://mcp.example/mcp/vercel",
      code_verifier: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._~"
    })
  });
  const response = await handleMcpToken(tokenRequest, { TOKENS_KV: kv });
  assert.equal(response.status, 400);
});
