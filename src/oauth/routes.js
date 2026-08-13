import { CONNECTORS } from "../../config/connectors.js";
import { authorizationUrl, exchangeCode } from "./oauth2.js";
import { saveTokens } from "./store.js";
import { requireInternalUser } from "../security/internal-auth.js";

const PATH_TO_PROVIDER = {
  cloud: "cloudflare",
  cloudflare: "cloudflare",
  vercel: "vercel",
  netlify: "netlify",
  sentry: "sentry",
  atlassian: "atlassian",
  google: "google"
};

async function createState(kv, provider, userId) {
  if (!kv) throw new Error("TOKENS_KV binding is required for OAuth state");
  const state = crypto.randomUUID();
  await kv.put(
    `oauth_state:${state}`,
    JSON.stringify({ provider, userId, createdAt: Date.now() }),
    { expirationTtl: 600 }
  );
  return state;
}

async function consumeState(kv, state, provider) {
  if (!kv || !state) return null;
  const raw = await kv.get(`oauth_state:${state}`, "json");
  if (!raw || raw.provider !== provider || !raw.userId) return null;
  await kv.delete(`oauth_state:${state}`);
  return raw;
}

function securityHeaders() {
  return {
    "cache-control": "no-store",
    "pragma": "no-cache",
    "x-content-type-options": "nosniff"
  };
}

export async function handleOAuth(request, env, path) {
  const match = path.match(/^\/oauth\/([^/]+)(?:\/(start|callback))?$/);
  if (!match) return null;

  const requestedProvider = match[1];
  const provider = PATH_TO_PROVIDER[requestedProvider] || requestedProvider;
  if (!Object.prototype.hasOwnProperty.call(CONNECTORS, provider) || provider === "airtable" || provider === "supabase") {
    return new Response("Unknown or externally-authenticated OAuth provider", { status: 404 });
  }

  const url = new URL(request.url);
  const explicitAction = match[2];
  const isCallback = explicitAction === "callback" || (!explicitAction && (url.searchParams.has("code") || url.searchParams.has("error")));

  if (!isCallback) {
    const userId = await requireInternalUser(request, env);
    if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401, headers: securityHeaders() });
    const state = await createState(env.TOKENS_KV, provider, userId);
    return Response.redirect(authorizationUrl(request, env, provider, state).toString(), 302);
  }

  const error = url.searchParams.get("error");
  if (error) {
    return Response.json(
      { error, description: url.searchParams.get("error_description") },
      { status: 400, headers: securityHeaders() }
    );
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("Missing OAuth code or state", { status: 400, headers: securityHeaders() });

  const stateRecord = await consumeState(env.TOKENS_KV, state, provider);
  if (!stateRecord) return new Response("Invalid or expired OAuth state", { status: 400, headers: securityHeaders() });

  try {
    const tokens = await exchangeCode(request, env, provider, code);
    await saveTokens(env.TOKENS_KV, provider, tokens, stateRecord.userId);
    return Response.json(
      { ok: true, provider, message: "OAuth authorization completed" },
      { headers: securityHeaders() }
    );
  } catch {
    return Response.json(
      { error: "OAuth token exchange failed" },
      { status: 502, headers: securityHeaders() }
    );
  }
}
