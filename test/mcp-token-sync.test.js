import test from "node:test";
import assert from "node:assert/strict";
import { handleMcpTokenSync } from "../src/mcp/token-sync.js";
import { loadTokens, tokenKey } from "../src/oauth/store.js";

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

function syncRequest(secret, userId, accessToken) {
  return new Request("https://example.test/internal/mcp-token/vercel", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-nexus-user-id": userId,
      "x-nexus-signature": signature(secret, userId)
    },
    body: JSON.stringify({
      access_token: accessToken,
      refresh_token: `refresh-${userId}`,
      expires_in: 3600,
      scope: "mcp"
    })
  });
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

  const response = await handleMcpTokenSync(await syncRequest(secret, userId, "mcp-access-token"), env);
  assert.equal(response.status, 200);

  const raw = await TOKENS_KV.get("oauth:vercel:user-123");
  assert.ok(raw);
  assert.equal(raw.includes("mcp-access-token"), false);

  const stored = await loadTokens(TOKENS_KV, "vercel", userId, env.NEXUS_TOKEN_ENCRYPTION_SECRET);
  assert.equal(stored.access_token, "mcp-access-token");
  assert.equal(stored.refresh_token, "refresh-user-123");
});

test("never shares one user's MCP token with another user", async () => {
  const TOKENS_KV = kv();
  const secret = "internal-secret";
  const encryptionSecret = "separate-encryption-secret";
  const env = {
    TOKENS_KV,
    NEXUS_INTERNAL_AUTH_SECRET: secret,
    NEXUS_TOKEN_ENCRYPTION_SECRET: encryptionSecret
  };

  assert.equal((await handleMcpTokenSync(await syncRequest(secret, "alice", "alice-token"), env)).status, 200);
  assert.equal((await handleMcpTokenSync(await syncRequest(secret, "bob", "bob-token"), env)).status, 200);

  const alice = await loadTokens(TOKENS_KV, "vercel", "alice", encryptionSecret);
  const bob = await loadTokens(TOKENS_KV, "vercel", "bob", encryptionSecret);
  assert.equal(alice.access_token, "alice-token");
  assert.equal(bob.access_token, "bob-token");
  assert.notEqual(alice.access_token, bob.access_token);
  assert.equal(await loadTokens(TOKENS_KV, "vercel", "charlie", encryptionSecret), null);
});

test("token storage refuses an implicit global user scope", async () => {
  assert.throws(() => tokenKey("cloudflare"), /Explicit NEXUS userId is required/);
  assert.throws(() => tokenKey("cloudflare", ""), /Explicit NEXUS userId is required/);
});
