const { requireAdmin } = require("../../_lib/auth");
const { db } = require("../../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const { chatId, action } = req.query;
  if (!["approve", "reject"].includes(action)) return res.status(400).json({ error: "invalid action" });

  const status = action === "approve" ? "approved" : "rejected";
  const result = await db("managed_chats", { method: "PATCH", query: `?chat_id=eq.${chatId}`, body: { status, approved_at: new Date().toISOString() } });
  res.status(200).json({ ok: !result.error });
};
