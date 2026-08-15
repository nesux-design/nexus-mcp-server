import test from "node:test";
import assert from "node:assert/strict";
import { handleMcpTokenSync } from "../src/mcp/token-sync.js";
import { loadTokens } from "../src/oauth/store.js";

async function signature(secret, userId) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(userId)));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function kv() {
  const map = new Map();
  return {
    async put(key, value) { map.set(key, value); },
    async get(key) { return map.get(key) ?? null; },
    async delete(key) { map.delete(key); }
  };
}

test("syncs an upstream MCP token per user and stores it encrypted", async () => {
  const TOKENS_KV = kv();
  const secret = "internal-secret";
  const userId = "user-123";
  const env = {
    TOKENS_KV,
    NEXUS_INTERNAL_AUTH_SECRET: secret,
    NEXUS_TOKEN_ENCRYPTION_SECRET: "separate-encryption-secret"
  };
  const request = new Request("https://example.test/internal/mcp-token/vercel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nexus-user-id": userId,
      "x-nexus-signature": await signature(secret, userId)
    },
    body: JSON.stringify({
      access_token: "mcp-access-token",
      refresh_token: "mcp-refresh-token",
      expires_in: 3600,
      scope: "mcp"
    })
  });

  const response = await handleMcpTokenSync(request, env);
  assert.equal(response.status, 200);

  const raw = await TOKENS_KV.get("oauth:vercel:user-123");
  assert.ok(raw);
  assert.equal(raw.includes("mcp-access-token"), false);

  const stored = await loadTokens(TOKENS_KV, "vercel", userId, env.NEXUS_TOKEN_ENCRYPTION_SECRET);
  assert.equal(stored.access_token, "mcp-access-token");
  assert.equal(stored.refresh_token, "mcp-refresh-token");
});
