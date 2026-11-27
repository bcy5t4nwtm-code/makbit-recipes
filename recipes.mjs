import { getStore } from "@netlify/blobs";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");
const lines = (v) => (Array.isArray(v) ? v.slice(0, 200).map((x) => str(x, 2000)).filter(Boolean) : []);

function clean(body) {
  if (!body || !Array.isArray(body.recipes) || body.recipes.length > 2000) return null;
  return {
    recipes: body.recipes
      .map((r) => ({
        id: str(r.id, 40).replace(/[^\w-]/g, ""),
        title: str(r.title, 200).trim(),
        cat: str(r.cat, 40).replace(/[^\w-]/g, ""),
        desc: str(r.desc, 3000),
        ing: lines(r.ing),
        steps: lines(r.steps),
        tip: str(r.tip, 3000),
      }))
      .filter((r) => r.id && r.title),
  };
}

export default async (req) => {
  const store = getStore("recipes");

  if (req.method === "GET") {
    // אם עוד לא נשמר כלום – האתר משתמש במתכונים שבתוך index.html
    const data = (await store.get("all", { type: "json" })) || { recipes: null };
    return json(data);
  }

  if (req.method === "POST") {
    // אם מוגדר ADMIN_TOKEN ב-Netlify – צריך סיסמה. אם לא – כל אחד יכול להוסיף ולערוך.
    const token = process.env.ADMIN_TOKEN;
    if (token && req.headers.get("x-admin-token") !== token) return json({ error: "bad_token" }, 401);

    let body;
    try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
    if (body && body.check) return json({ ok: true });

    const data = clean(body);
    if (!data) return json({ error: "bad_data" }, 400);

    // גיבוי של הגרסה הקודמת לפני כל שמירה
    const prev = await store.get("all", { type: "json" });
    if (prev) await store.setJSON("backup-" + new Date().toISOString(), prev);

    await store.setJSON("all", data);
    return json({ ok: true, count: data.recipes.length });
  }

  return json({ error: "method" }, 405);
};

export const config = { path: "/api/recipes" };
