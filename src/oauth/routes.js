import { CONNECTORS } from "../../config/connectors.js";
import { authorizationUrl, exchangeCode } from "./oauth2.js";
import { saveTokens } from "./store.js";

const OAUTH_PROVIDERS = ["cloudflare", "vercel", "netlify", "sentry", "atlassian", "google"];

export async function handleOAuth(request, env, path) {
  const match = path.match(/^\/oauth\/([^/]+)(?:\/(start|callback))?$/);
  if (!match) return null;
  const provider = match[1];
  const action = match[2] || "start";
  if (!OAUTH_PROVIDERS.includes(provider) || !CONNECTORS[provider]) return new Response("Unknown OAuth provider", { status: 404 });

  if (action === "start") {
    return Response.redirect(authorizationUrl(request, env, provider).toString(), 302);
  }

  if (action === "callback") {
    const url = new URL(request.url);
    const error = url.searchParams.get("error");
    if (error) return Response.json({ error, description: url.searchParams.get("error_description") }, { status: 400 });
    const code = url.searchParams.get("code");
    if (!code) return new Response("Missing OAuth code", { status: 400 });
    const tokens = await exchangeCode(request, env, provider, code);
    await saveTokens(env.TOKENS_KV, provider, tokens);
    return Response.json({ ok: true, provider, message: "OAuth authorization completed" });
  }

  return new Response("Not found", { status: 404 });
}
