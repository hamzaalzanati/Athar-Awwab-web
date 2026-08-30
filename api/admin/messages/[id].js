const { requireAdmin } = require("../../_lib/auth");
const { db } = require("../../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "PATCH") return res.status(405).json({ error: "method not allowed" });
  const result = await db("contact_messages", { method: "PATCH", query: `?id=eq.${req.query.id}`, body: req.body });
  res.status(200).json({ ok: !result.error });
};
