import { CONNECTORS } from "../../config/connectors.js";
import { saveTokens, deleteTokens } from "../oauth/store.js";
import { requireInternalUser } from "../security/internal-auth.js";

function headers() { return { "cache-control": "no-store", "pragma": "no-cache", "x-content-type-options": "nosniff" }; }
function normalizeTokens(body) {
  const accessToken = typeof body?.access_token === "string" ? body.access_token.trim() : "";
  if (!accessToken || accessToken.length > 8192) return null;
  const refreshToken = typeof body?.refresh_token === "string" ? body.refresh_token.trim() : undefined;
  const expiresIn = Number(body?.expires_in || 0);
  const expiresAt = Number(body?.expires_at || 0);
  const record = { access_token: accessToken, token_type: typeof body?.token_type === "string" ? body.token_type : "Bearer", scope: typeof body?.scope === "string" ? body.scope : undefined };
  if (refreshToken) record.refresh_token = refreshToken;
  if (expiresAt > 0) record.expires_at = expiresAt > 1e12 ? expiresAt : expiresAt * 1000;
  else if (expiresIn > 0) record.expires_in = Math.min(expiresIn, 31_536_000);
  return record;
}
export async function handleMcpTokenSync(request, env) {
  const userId = await requireInternalUser(request, env);
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: headers() });
  const url = new URL(request.url);
  const provider = url.pathname.split("/").filter(Boolean).at(-1);
  const connector = CONNECTORS[provider];
  if (!connector?.mcp) return Response.json({ error: "Unknown MCP provider" }, { status: 404, headers: headers() });
  if (request.method === "DELETE") { await deleteTokens(env, provider, userId); return Response.json({ ok: true, provider, revoked: true }, { headers: headers() }); }
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: { ...headers(), allow: "POST, DELETE" } });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: headers() }); }
  const tokens = normalizeTokens(body);
  if (!tokens) return Response.json({ error: "access_token is required" }, { status: 400, headers: headers() });
  const encryptionSecret = env.NEXUS_TOKEN_ENCRYPTION_SECRET || env.NEXUS_INTERNAL_AUTH_SECRET;
  await saveTokens(env, provider, tokens, userId, encryptionSecret);
  const expiresAt = tokens.expires_at || (tokens.expires_in ? Date.now() + tokens.expires_in * 1000 : null);
  return Response.json({ ok: true, provider, userId, stored: true, expires_at: expiresAt }, { headers: headers() });
}
