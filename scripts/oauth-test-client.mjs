import http from "node:http";
import crypto from "node:crypto";
import { exec } from "node:child_process";

const BASE_URL = process.env.NEXUS_MCP_BASE_URL || "https://nexus-mcp-server.apikeyakhilka.workers.dev";
const PROVIDER = process.env.NEXUS_MCP_PROVIDER || "cloudflare";
const CLIENT_ID = process.env.MCP_TRUSTED_CLIENT_ID || "nexus-backend-test-client";
const REDIRECT_URI = process.env.MCP_TRUSTED_CLIENT_REDIRECT_URI || "http://127.0.0.1:8787/oauth/callback";
const USER_ID = process.env.NEXUS_TEST_USER_ID || process.env.NEXUS_USER_ID;
const SECRET = process.env.NEXUS_INTERNAL_AUTH_SECRET;
const RESOURCE = `${BASE_URL}/mcp/${PROVIDER}`;

function fail(message) {
  console.error(`\nOAuth test failed: ${message}`);
  process.exitCode = 1;
}

function base64url(buffer) {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pkce() {
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function signHandoff(userId, exp) {
  return crypto.createHmac("sha256", SECRET).update(`${userId}.${exp}`).digest("hex");
}

function openBrowser(url) {
  const command = process.platform === "win32"
    ? `start "" "${url}"`
    : process.platform === "darwin"
      ? `open "${url}"`
      : `xdg-open "${url}"`;
  exec(command, (error) => {
    if (error) console.log(`Open this URL in your browser:\n${url}\n`);
  });
}

async function exchangeCode(code, verifier, state, iss) {
  const expectedIssuer = `${BASE_URL}/oauth`;
  if (iss !== expectedIssuer) throw new Error(`issuer mismatch: expected ${expectedIssuer}, received ${iss || "missing"}`);
  if (state !== expectedState) throw new Error("state mismatch");

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    resource: RESOURCE,
  });

  const response = await fetch(`${BASE_URL}/oauth/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`token endpoint HTTP ${response.status}: ${text}`);
  const token = JSON.parse(text);
  if (!token.access_token) throw new Error("token endpoint returned no access_token");
  return token;
}

async function callMcp(accessToken) {
  const response = await fetch(RESOURCE, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "tools/list",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {
        "io.modelcontextprotocol/protocolVersion": "2026-07-28",
        "io.modelcontextprotocol/clientCapabilities": {},
        _meta: {
          "io.modelcontextprotocol/clientInfo": { name: "nexus-oauth-test-client", version: "1.0.0" },
        },
      },
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`MCP request HTTP ${response.status}: ${text}`);
  return JSON.parse(text);
}

if (!USER_ID) {
  fail("NEXUS_TEST_USER_ID (or NEXUS_USER_ID) is not set");
  process.exit();
}
if (!SECRET) {
  fail("NEXUS_INTERNAL_AUTH_SECRET is not set; keep this secret out of source control");
  process.exit();
}
if (!/^http:\/\/127\.0\.0\.1:\d+\/.+/.test(REDIRECT_URI)) {
  fail(`expected loopback redirect URI, received ${REDIRECT_URI}`);
  process.exit();
}

const { verifier, challenge } = pkce();
const expectedState = base64url(crypto.randomBytes(24));
const exp = Math.floor(Date.now() / 1000) + 300;
const signature = signHandoff(USER_ID, exp);

const authUrl = new URL(`${BASE_URL}/oauth/authorize`);
authUrl.searchParams.set("response_type", "code");
authUrl.searchParams.set("client_id", CLIENT_ID);
authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
authUrl.searchParams.set("state", expectedState);
authUrl.searchParams.set("code_challenge", challenge);
authUrl.searchParams.set("code_challenge_method", "S256");
authUrl.searchParams.set("resource", RESOURCE);
authUrl.searchParams.set("scope", "mcp");

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url, REDIRECT_URI);
  if (requestUrl.pathname !== "/oauth/callback") {
    response.writeHead(404);
    response.end("Not found");
    return;
  }

  try {
    const error = requestUrl.searchParams.get("error");
    if (error) throw new Error(`${error}: ${requestUrl.searchParams.get("error_description") || "authorization failed"}`);

    const code = requestUrl.searchParams.get("code");
    const state = requestUrl.searchParams.get("state");
    const iss = requestUrl.searchParams.get("iss");
    if (!code || !state || !iss) throw new Error("callback is missing code, state, or iss");

    console.log("Authorization code received. Exchanging it for an access token...");
    const token = await exchangeCode(code, verifier, state, iss);
    console.log(`Token issued successfully (expires_in=${token.expires_in ?? "unknown"}).`);
    console.log(`Granted scope: ${token.scope || "(none returned)"}`);

    console.log("Calling the protected MCP endpoint...");
    const mcp = await callMcp(token.access_token);
    const toolCount = Array.isArray(mcp?.result?.tools) ? mcp.result.tools.length : 0;
    console.log(`MCP authorization test PASSED. tools/list returned ${toolCount} tool(s).`);

    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<h1>NEXUS OAuth test passed</h1><p>You can close this tab.</p>");
    setTimeout(() => server.close(() => process.exit(0)), 100);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    response.end(`OAuth test failed: ${message}`);
    setTimeout(() => server.close(() => { process.exitCode = 1; process.exit(); }), 100);
  }
});

server.listen(new URL(REDIRECT_URI).port, "127.0.0.1", async () => {
  console.log("NEXUS OAuth end-to-end test client");
  console.log(`Resource: ${RESOURCE}`);
  console.log(`Client: ${CLIENT_ID}`);
  console.log(`Callback: ${REDIRECT_URI}`);
  console.log("Starting authorization...");

  const response = await fetch(authUrl, {
    redirect: "manual",
    headers: {
      "x-nexus-user-id": USER_ID,
      "x-nexus-signature": signature,
      "x-nexus-user-exp": String(exp),
      accept: "text/html,application/xhtml+xml,application/json",
    },
  });

  if (response.status < 300 || response.status >= 400) {
    const text = await response.text();
    server.close();
    fail(`authorization endpoint returned HTTP ${response.status}: ${text}`);
    return;
  }

  const location = response.headers.get("location");
  if (!location) {
    server.close();
    fail("authorization endpoint returned a redirect without Location");
    return;
  }

  console.log(`Authorization redirect received (HTTP ${response.status}).`);
  openBrowser(location);
});
