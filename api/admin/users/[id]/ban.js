const { requireAdmin } = require("../../../_lib/auth");
const { db } = require("../../../_lib/db");
const { tg } = require("../../../_lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "method not allowed" });

  const chatsRes = await db("managed_chats", { query: "?status=eq.approved&select=chat_id" });
  let done = 0, failed = 0;
  for (const row of chatsRes.data || []) {
    const result = await tg("banChatMember", { chat_id: row.chat_id, user_id: Number(req.query.id) });
    if (result.ok) done++; else failed++;
  }
  res.status(200).json({ ok: true, done, failed });
};
