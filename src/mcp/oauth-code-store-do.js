import { DurableObject } from "cloudflare:workers";

const encoder = new TextEncoder();
const CODE_TTL_SECONDS = 120;

function b64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return b64(new Uint8Array(digest));
}

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "content-type": "application/json" }
  });
}

export class OAuthCodeStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS authorization_codes (
        code_hash TEXT PRIMARY KEY,
        record TEXT NOT NULL,
        exp INTEGER NOT NULL
      )
    `);
  }

  async fetch(request) {
    if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid_json" }, 400);
    }

    if (body?.op === "create") {
      const code = b64(crypto.getRandomValues(new Uint8Array(32)));
      const codeHash = await sha256(code);
      const now = Math.floor(Date.now() / 1000);
      const exp = now + CODE_TTL_SECONDS;
      const record = { v: 1, ...body.record, createdAt: now, exp };
      this.ctx.storage.sql.exec(
        "INSERT INTO authorization_codes (code_hash, record, exp) VALUES (?, ?, ?)",
        codeHash,
        JSON.stringify(record),
        exp
      );
      return json({ code });
    }

    if (body?.op === "consume") {
      if (typeof body.code !== "string" || body.code.length < 20 || body.code.length > 512) {
        return json({ record: null });
      }
      const codeHash = await sha256(body.code);
      const now = Math.floor(Date.now() / 1000);
      const row = this.ctx.storage.sql.exec(
        "SELECT record, exp FROM authorization_codes WHERE code_hash = ? LIMIT 1",
        codeHash
      ).toArray()[0];

      if (!row || Number(row.exp) <= now) {
        if (row) this.ctx.storage.sql.exec("DELETE FROM authorization_codes WHERE code_hash = ?", codeHash);
        return json({ record: null });
      }

      this.ctx.storage.sql.exec("DELETE FROM authorization_codes WHERE code_hash = ?", codeHash);
      try {
        return json({ record: JSON.parse(row.record) });
      } catch {
        return json({ record: null });
      }
    }

    return json({ error: "unknown_operation" }, 400);
  }
}
