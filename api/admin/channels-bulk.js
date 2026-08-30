/* إجراءات جماعية: أرشفة/إلغاء أرشفة/تغيير فئة/تغيير posts_mode لعدة قنوات
   مختارة دفعة واحدة (أفكار 1 و18 من قائمة "إدارة كل القنوات من مكان واحد") */
const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { ids, field, value } = req.body || {};
  if (!Array.isArray(ids) || !ids.length || !field) {
    return res.status(400).json({ error: "محتاج ids[] و field و value" });
  }

  const allowedFields = ["archived", "category", "posts_mode", "is_featured"];
  if (!allowedFields.includes(field)) return res.status(400).json({ error: "field غير مسموح" });

  let done = 0;
  for (const id of ids) {
    const result = await db("channels", { method: "PATCH", query: `?id=eq.${id}`, body: { [field]: value } });
    if (!result.error) done++;
  }
  res.status(200).json({ ok: true, updated: done, total: ids.length });
};
