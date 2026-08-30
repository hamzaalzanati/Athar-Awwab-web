const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = await db("channels", { query: "?select=*&order=sort_order.asc" });
  const rows = result.data || [];
  const header = "id,name,category,url,subscriber_count,archived,posts_mode";
  const csv = [header, ...rows.map((r) =>
    [r.id, r.name, r.category, r.url, r.subscriber_count ?? "", r.archived, r.posts_mode].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
  )].join("\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=channels.csv");
  res.status(200).send("\uFEFF" + csv); // BOM عشان اكسيل يقرأ العربي صح
};
