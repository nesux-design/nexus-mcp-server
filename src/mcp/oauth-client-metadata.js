const MAX_METADATA_BYTES = 32768;
const FETCH_TIMEOUT_MS = 5000;

function parseHttpsUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hash || !url.pathname) return null;
    return url;
  } catch {
    return null;
  }
}

async function readJson(response) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_METADATA_BYTES) throw new Error("Client metadata document is too large");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_METADATA_BYTES) throw new Error("Client metadata document is too large");
  return JSON.parse(text);
}

export async function fetchClientIdMetadata(clientId) {
  if (!parseHttpsUrl(clientId)) throw new Error("client_id must be an HTTPS URL with a path");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(clientId, {
      method: "GET",
      headers: { accept: "application/json" },
      redirect: "error",
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`Client metadata request failed with HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) throw new Error("Client metadata document must be JSON");
    return await readJson(response);
  } finally {
    clearTimeout(timeout);
  }
}

export function validateClientMetadata(clientId, metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) throw new Error("Invalid client metadata document");
  if (metadata.client_id !== clientId) throw new Error("client_id does not match the metadata document URL");
  if (typeof metadata.client_name !== "string" || !metadata.client_name.trim()) throw new Error("client_name is required");
  if (!Array.isArray(metadata.redirect_uris) || metadata.redirect_uris.length === 0) throw new Error("redirect_uris is required");

  for (const redirectUri of metadata.redirect_uris) {
    if (typeof redirectUri !== "string") throw new Error("redirect_uris must contain strings");
    let parsed;
    try { parsed = new URL(redirectUri); } catch { throw new Error("Invalid redirect URI"); }
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !local) throw new Error("Redirect URIs must use HTTPS or localhost");
  }

  if (metadata.grant_types && (!Array.isArray(metadata.grant_types) || !metadata.grant_types.includes("authorization_code"))) throw new Error("authorization_code grant is required");
  if (metadata.response_types && (!Array.isArray(metadata.response_types) || !metadata.response_types.includes("code"))) throw new Error("code response type is required");
  if (metadata.token_endpoint_auth_method && metadata.token_endpoint_auth_method !== "none") throw new Error("Only public clients using token_endpoint_auth_method=none are supported");

  return {
    client_id: clientId,
    client_name: metadata.client_name,
    redirect_uris: [...metadata.redirect_uris],
    grant_types: metadata.grant_types || ["authorization_code"],
    response_types: metadata.response_types || ["code"],
    token_endpoint_auth_method: metadata.token_endpoint_auth_method || "none"
  };
}

export async function resolveClientMetadata(clientId) {
  return validateClientMetadata(clientId, await fetchClientIdMetadata(clientId));
}
