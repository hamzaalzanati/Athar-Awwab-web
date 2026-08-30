const { requireAdmin } = require("../../../_lib/auth");
const { tg } = require("../../../_lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const result = await tg("sendMessage", { chat_id: req.query.id, text: req.body.text });
  if (!result.ok) return res.status(502).json({ error: "المستخدم مغلق البوت أو رقمه غلط" });
  res.status(200).json({ ok: true });
};
