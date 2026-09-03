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
      CREATE TABLE IF NOT EXISTS oauth_records (
        record_key TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        value TEXT NOT NULL,
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

    if (!["put", "get", "consume"].includes(body?.op)) {
      return json({ error: "unknown_operation" }, 400);
    }
    if (typeof body.kind !== "string" || typeof body.value !== "string") {
      return json({ error: "invalid_record_key" }, 400);
    }

    const key = await sha256(body.value);
    const now = Math.floor(Date.now() / 1000);

    if (body.op === "put") {
      const ttl = body.kind === "authorization_code" ? CODE_TTL_SECONDS : Number(body.ttl);
      if (!Number.isInteger(ttl) || ttl <= 0 || ttl > 86400) return json({ error: "invalid_ttl" }, 400);
      const exp = now + ttl;
      const record = { v: 1, ...(body.record || {}), createdAt: now, exp };
      this.ctx.storage.sql.exec(
        "INSERT OR REPLACE INTO oauth_records (record_key, kind, value, record, exp) VALUES (?, ?, ?, ?, ?)",
        key,
        body.kind,
        body.value,
        JSON.stringify(record),
        exp
      );
      return json({ ok: true });
    }

    if (body.op === "get") {
      const row = this.ctx.storage.sql.exec(
        "SELECT record, exp FROM oauth_records WHERE record_key = ? AND kind = ? LIMIT 1",
        key,
        body.kind
      ).toArray()[0];
      if (!row || Number(row.exp) <= now) {
        if (row) this.ctx.storage.sql.exec("DELETE FROM oauth_records WHERE record_key = ?", key);
        return json({ record: null });
      }
      try {
        return json({ record: JSON.parse(row.record) });
      } catch {
        return json({ record: null });
      }
    }

    const row = this.ctx.storage.sql.exec(
      "SELECT record, exp FROM oauth_records WHERE record_key = ? AND kind = ? LIMIT 1",
      key,
      body.kind
    ).toArray()[0];
    if (!row || Number(row.exp) <= now) {
      if (row) this.ctx.storage.sql.exec("DELETE FROM oauth_records WHERE record_key = ?", key);
      return json({ record: null });
    }

    this.ctx.storage.sql.exec("DELETE FROM oauth_records WHERE record_key = ?", key);
    try {
      return json({ record: JSON.parse(row.record) });
    } catch {
      return json({ record: null });
    }
  }
}
