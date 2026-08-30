const { requireAdmin } = require("../../../_lib/auth");
const { db } = require("../../../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const cur = await db("bot_users", { query: `?telegram_id=eq.${req.query.id}&select=reported_count` });
  const count = (cur.data?.[0]?.reported_count || 0) + 1;
  await db("bot_users", { method: "PATCH", query: `?telegram_id=eq.${req.query.id}`, body: { reported_count: count } });
  res.status(200).json({ ok: true, reported_count: count });
};
