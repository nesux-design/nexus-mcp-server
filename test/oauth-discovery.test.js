import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

const origin = "https://nexus.example";
const discoveryPaths = [
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/oauth",
  "/.well-known/openid-configuration/oauth",
  "/oauth/.well-known/openid-configuration"
];

test("OAuth authorization-server discovery aliases return equivalent metadata", async () => {
  const responses = await Promise.all(
    discoveryPaths.map((path) => worker.fetch(new Request(`${origin}${path}`), {}))
  );

  for (const response of responses) assert.equal(response.status, 200);

  const metadata = await Promise.all(responses.map((response) => response.json()));
  for (const item of metadata) {
    assert.equal(item.issuer, `${origin}/oauth`);
    assert.equal(item.authorization_endpoint, `${origin}/oauth/authorize`);
    assert.equal(item.token_endpoint, `${origin}/oauth/token`);
    assert.deepEqual(item.code_challenge_methods_supported, ["S256"]);
    assert.equal(item.client_id_metadata_document_supported, true);
  }

  assert.deepEqual(metadata[1], metadata[0]);
  assert.deepEqual(metadata[2], metadata[0]);
  assert.deepEqual(metadata[3], metadata[0]);
});
