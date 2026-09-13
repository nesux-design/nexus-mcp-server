import test from "node:test";
import assert from "node:assert/strict";
import { discoveryStatus } from "../src/mcp/custom-discovery.js";

test("custom discovery classifies OAuth metadata as oauth_ready", () => {
  assert.equal(discoveryStatus({ ok: true, authMode: "oauth" }), "oauth_ready");
});

test("custom discovery classifies reachable endpoints without OAuth metadata as unverified", () => {
  assert.equal(discoveryStatus({ ok: true, authMode: "unknown" }), "unverified");
});

test("custom discovery classifies failed probes as errors", () => {
  assert.equal(discoveryStatus({ ok: false, error: "timeout" }), "error");
});
