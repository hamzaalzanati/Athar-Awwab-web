const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const filter = req.query.tag ? `&manual_tag=eq.${req.query.tag}` : "";
  const result = await db("bot_users", { query: `?select=telegram_id,username,first_name,manual_tag,joined_at${filter}` });
  const rows = result.data || [];
  const csv = ["telegram_id,username,first_name,manual_tag,joined_at", ...rows.map((r) => `${r.telegram_id},${r.username || ""},${r.first_name || ""},${r.manual_tag || ""},${r.joined_at}`)].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=users.csv");
  res.status(200).send("\uFEFF" + csv);
};
