// إحصاءات مجهولة: عدّادات يومية فقط. لا IP ولا معرّفات زوار ولا كوكيز.
import { db } from "../lib/db.js";
import { isUuid } from "../lib/validate.js";

const PATH_OK = /^\/[\p{L}\p{N}\/_\-%.]{0,190}$/u;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    if (/bot|crawl|spider|headless/i.test(String(req.headers["user-agent"] ?? ""))) return res.status(204).end();
    if (typeof b.path === "string" && PATH_OK.test(b.path) && !b.path.startsWith("/tg") && !b.path.startsWith("/api"))
      await db().rpc("bump_view", { p_path: b.path });
    if (isUuid(b.entity)) await db().rpc("bump_click", { p_entity: b.entity });
  } catch { /* الإحصاءات لا تكسر الموقع */ }
  res.status(204).end();
}
