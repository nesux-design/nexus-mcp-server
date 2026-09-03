export class OAuthStateDurableObject {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
  }

  async fetch(request) {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "invalid_request" }, { status: 400 });
    }

    const key = typeof body.key === "string" ? body.key : null;
    const action = typeof body.action === "string" ? body.action : null;
    if (!key || !action) return Response.json({ error: "invalid_request" }, { status: 400 });

    if (action === "put") {
      if (typeof body.value !== "string") return Response.json({ error: "invalid_request" }, { status: 400 });
      await this.ctx.storage.put(key, body.value);
      return Response.json({ ok: true });
    }

    if (action === "get") {
      const value = await this.ctx.storage.get(key);
      return Response.json({ value: value ?? null });
    }

    if (action === "consume") {
      const value = await this.ctx.storage.get(key);
      if (value !== undefined) await this.ctx.storage.delete(key);
      return Response.json({ value: value ?? null });
    }

    if (action === "delete") {
      await this.ctx.storage.delete(key);
      return Response.json({ ok: true });
    }

    return Response.json({ error: "unknown_action" }, { status: 400 });
  }
}
