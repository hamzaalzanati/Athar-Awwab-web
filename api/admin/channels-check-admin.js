/* فحص صلاحيات الأدمن لكل القنوات دفعة واحدة (فكرة 19) — بيتأكد إن البوت
   لسه أدمن فعليًا في كل قناة، ويحدّث حقل "health" (فكرة 20: شارة لونية) */
const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");
const { tg, BOT_TOKEN } = require("../_lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const me = await tg("getMe", {});
  if (!me.ok) return res.status(500).json({ error: "تعذّر التحقق من هوية البوت" });
  const botId = me.result.id;

  const chatsRes = await db("managed_chats", { query: "?status=eq.approved&select=chat_id,title" });
  const results = [];
  for (const row of chatsRes.data || []) {
    const member = await tg("getChatMember", { chat_id: row.chat_id, user_id: botId });
    const healthy = member.ok && ["administrator", "creator"].includes(member.result.status);
    results.push({ chat_id: row.chat_id, title: row.title, healthy });
    if (!healthy) {
      await db("managed_chats", { method: "PATCH", query: `?chat_id=eq.${row.chat_id}`, body: { status: "lost_access" } });
    }
  }
  res.status(200).json({ checked: results.length, unhealthy: results.filter((r) => !r.healthy), results });
};
