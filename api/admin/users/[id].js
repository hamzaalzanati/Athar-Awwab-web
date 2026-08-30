const { requireAdmin } = require("../../_lib/auth");
const { db } = require("../../_lib/db");
const { tg } = require("../../_lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const id = req.query.id;

  if (req.method === "GET") {
    const [userRes, chatsRes, activityRes] = await Promise.all([
      db("bot_users", { query: `?telegram_id=eq.${id}&select=*` }),
      db("managed_chats", { query: "?status=eq.approved&select=chat_id,title" }),
      db("user_activity_daily", { query: `?telegram_id=eq.${id}&select=*&order=activity_date.desc&limit=30` })
    ]);
    const user = userRes.data?.[0];
    if (!user) return res.status(404).json({ error: "مش موجود" });

    // فكرة 2: في أي قنوات من قنواتك هو عضو فعليًا
    const memberOf = [];
    for (const row of chatsRes.data || []) {
      const member = await tg("getChatMember", { chat_id: row.chat_id, user_id: Number(id) });
      if (member.ok && ["member", "administrator", "creator"].includes(member.result.status)) memberOf.push(row.title);
    }

    // متوسط نشاط باقي المستخدمين للمقارنة (فكرة 26)
    const allActivity = await db("user_activity_daily", { query: "?select=event_count" });
    const avgActivity = allActivity.data?.length
      ? (allActivity.data.reduce((s, r) => s + r.event_count, 0) / allActivity.data.length).toFixed(1)
      : null;
    const myActivity = activityRes.data?.reduce((s, r) => s + r.event_count, 0) || 0;

    return res.status(200).json({ ...user, memberOf, activity: activityRes.data || [], avgActivity, myActivityTotal: myActivity });
  }

  if (req.method === "PATCH") {
    const result = await db("bot_users", { method: "PATCH", query: `?telegram_id=eq.${id}`, body: req.body });
    return res.status(200).json({ ok: !result.error });
  }

  res.status(405).json({ error: "method not allowed" });
};
