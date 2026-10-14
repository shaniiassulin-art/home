import { getStore } from "@netlify/blobs";
import SEED from "./seed.mjs";

// GET    /api/tasks      -> { tasks: { id: task } }
// PUT    /api/tasks/:id  -> save one task
// DELETE /api/tasks/:id  -> delete one task
// Each task is its own blob, so edits to different tasks from different devices never overwrite each other.

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

export default async (req, context) => {
  const store = getStore({ name: "house-tasks", consistency: "strong" });
  const id = context.params?.id;

  if (req.method === "GET" && !id) {
    const { blobs } = await store.list({ prefix: "t/" });
    if (!blobs.length && !(await store.get("meta/seeded"))) {
      await Promise.all(Object.entries(SEED).map(([k, v]) => store.setJSON("t/" + k, v)));
      await store.set("meta/seeded", new Date().toISOString());
      return json({ tasks: SEED });
    }
    const entries = await Promise.all(
      blobs.map(async (b) => [b.key.slice(2), await store.get(b.key, { type: "json" })])
    );
    return json({ tasks: Object.fromEntries(entries.filter(([, v]) => v)) });
  }

  if (!id || !ID.test(id)) return json({ error: "מזהה משימה לא תקין" }, 400);

  if (req.method === "PUT") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "גוף הבקשה אינו JSON" }, 400); }
    if (!body || typeof body.name !== "string" || !body.name.trim() || JSON.stringify(body).length > 20000)
      return json({ error: "משימה לא תקינה" }, 400);
    await store.setJSON("t/" + id, body);
    return json({ ok: true });
  }

  if (req.method === "DELETE") {
    await store.delete("t/" + id);
    return json({ ok: true });
  }

  return json({ error: "פעולה לא נתמכת" }, 405);
};

export const config = { path: ["/api/tasks", "/api/tasks/:id"] };
