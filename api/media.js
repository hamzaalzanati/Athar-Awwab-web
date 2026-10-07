// يحوّل مرجع صورة تيليجرام (file_id) إلى صورة مصغّرة عند الطلب فقط. لا نخزّن أي صورة.
import { db } from "../lib/db.js";
import { fetchTelegramImage, MediaError } from "../lib/telegram-media.js";
import { isUuid } from "../lib/validate.js";

const STATUS = { bad_request: 400, not_found: 404, too_large: 404, not_image: 404, upstream: 502 };

export default async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const m = String(req.query?.m ?? ""), i = Number(req.query?.i ?? 0);
  if (!token) return res.status(503).end();
  if (!isUuid(m) || !Number.isInteger(i) || i < 0 || i > 9) return res.status(400).end();
  try {
    const { data: rows } = await db().from("preview_messages")
      .select("message_type,file_id,thumb_file_id,album_items,entity_id").eq("id", m).limit(1);
    const row = rows?.[0];
    if (!row) return res.status(404).end();
    const { data: ent } = await db().from("entities").select("id").eq("id", row.entity_id).eq("status", "active").limit(1);
    if (!ent?.length) return res.status(404).end(); // معاينة كيان غير منشور لا تُخدَم
    let fileId = null;
    if (row.message_type === "album") fileId = Array.isArray(row.album_items) ? row.album_items[i] : null;
    else if (i === 0) fileId = row.message_type === "photo" ? row.file_id : row.thumb_file_id;
    if (typeof fileId !== "string" || !fileId) return res.status(404).end();

    const { bytes, contentType } = await fetchTelegramImage(fileId, token, fetch);
    res.status(200).setHeader("Content-Type", contentType).setHeader("X-Content-Type-Options", "nosniff")
      .setHeader("Cache-Control", "public, max-age=3600, s-maxage=604800, stale-while-revalidate=86400").send(Buffer.from(bytes));
  } catch (err) {
    const code = err instanceof MediaError ? err.code : "upstream";
    res.status(STATUS[code] ?? 502).setHeader("Cache-Control", "public, s-maxage=60").end();
  }
}
