/* استيراد قنوات دفعة واحدة (فكرة 9) — بتاخد مصفوفة [{name,url,category,description}] */
const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const rows = req.body?.rows;
  if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "محتاج rows[] فيها {name,url,category}" });

  let created = 0, failed = 0;
  for (const row of rows) {
    if (!row.name || !row.url) { failed++; continue; }
    const result = await db("channels", { method: "POST", body: { name: row.name, url: row.url, category: row.category || "quran", description: row.description || null } });
    if (result.error) failed++; else created++;
  }
  res.status(200).json({ ok: true, created, failed });
};
