import test from "node:test";
import assert from "node:assert/strict";
import { createPkceChallenge, createPkceVerifier } from "../src/oauth/upstream-mcp-oauth.js";

test("Atlassian MCP PKCE verifier is high entropy and URL safe", () => {
  const verifier = createPkceVerifier();
  assert.match(verifier, /^[A-Za-z0-9_-]+$/);
  assert.ok(verifier.length >= 43);
});

test("Atlassian MCP PKCE challenge uses SHA-256", async () => {
  const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
  const challenge = await createPkceChallenge(verifier);
  assert.equal(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
});
