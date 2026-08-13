import test from "node:test";
import assert from "node:assert/strict";
import { requireInternalUser } from "../src/security/internal-auth.js";

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

test("rejects requests without gateway authentication", async () => {
  const request = new Request("https://example.test/mcp/airtable");
  assert.equal(await requireInternalUser(request, { NEXUS_INTERNAL_AUTH_SECRET: "secret" }), null);
});

test("accepts a correctly signed stable user id", async () => {
  const secret = "production-secret";
  const userId = "user-123";
  const request = new Request("https://example.test/mcp/airtable", {
    headers: {
      "x-nexus-user-id": userId,
      "x-nexus-signature": await signature(secret, userId)
    }
  });
  assert.equal(await requireInternalUser(request, { NEXUS_INTERNAL_AUTH_SECRET: secret }), userId);
});

test("rejects a tampered user id/signature pair", async () => {
  const secret = "production-secret";
  const request = new Request("https://example.test/mcp/airtable", {
    headers: {
      "x-nexus-user-id": "attacker",
      "x-nexus-signature": await signature(secret, "user-123")
    }
  });
  assert.equal(await requireInternalUser(request, { NEXUS_INTERNAL_AUTH_SECRET: secret }), null);
});
