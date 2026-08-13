import { CONNECTORS } from "../../config/connectors.js";
import { authorizationUrl, exchangeCode } from "./oauth2.js";
import { saveTokens } from "./store.js";

const PATH_TO_PROVIDER = {
  cloud: "cloudflare",
  cloudflare: "cloudflare",
  vercel: "vercel",
  netlify: "netlify",
  sentry: "sentry",
  atlassian: "atlassian",
  google: "google"
};

async function createState(kv, provider) {
  const state = crypto.randomUUID();
  if (kv) await kv.put(`oauth_state:${state}`, JSON.stringify({ provider, createdAt: Date.now() }), { expirationTtl: 600 });
  return state;
}

async function consumeState(kv, state, provider) {
  if (!kv || !state) return false;
  const raw = await kv.get(`oauth_state:${state}`, "json");
  if (!raw || raw.provider !== provider) return false;
  await kv.delete(`oauth_state:${state}`);
  return true;
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
    const state = await createState(env.TOKENS_KV, provider);
    return Response.redirect(authorizationUrl(request, env, provider, state).toString(), 302);
  }

  const error = url.searchParams.get("error");
  if (error) return Response.json({ error, description: url.searchParams.get("error_description") }, { status: 400 });

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return new Response("Missing OAuth code or state", { status: 400 });
  if (!(await consumeState(env.TOKENS_KV, state, provider))) return new Response("Invalid or expired OAuth state", { status: 400 });

  const tokens = await exchangeCode(request, env, provider, code);
  await saveTokens(env.TOKENS_KV, provider, tokens);
  return Response.json({ ok: true, provider, message: "OAuth authorization completed" });
}
