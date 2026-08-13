const encoder = new TextEncoder();

function toBytes(value) {
  return encoder.encode(value);
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    toBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return hex(await crypto.subtle.sign("HMAC", key, toBytes(value)));
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function requireInternalUser(request, env) {
  const userId = request.headers.get("x-nexus-user-id");
  const signature = request.headers.get("x-nexus-signature");
  const secret = env.NEXUS_INTERNAL_AUTH_SECRET;
  if (!userId || !signature || !secret) return null;
  const expected = await hmac(secret, userId);
  return timingSafeEqual(signature.toLowerCase(), expected) ? userId : null;
}
