/* =========================================================
   api/admin.js — كل نقاط لوحة التحكم في ملف واحد
   =========================================================
   ليه ملف واحد بدل ملف لكل نقطة؟ لأن Vercel (الخطة المجانية) بتسمح
   بـ 12 Serverless Function بس لكل نشر — وكان عندنا 17 ملف بس للوحة
   التحكم. الحل الصحيح مش رفع الخطة، هو تقليل عدد الدوال فعليًا عن
   طريق التوجيه الداخلي (?action=...) بدل ملف منفصل لكل عملية.
   النتيجة: نفس كل الوظائف، بس في دالة واحدة بدل 17.

   الاستدعاء من الفرونت إند: GET/POST/PATCH /api/admin?action=xxx
   ========================================================= */

const { requireAdmin } = require("../lib/auth");
const { db } = require("../lib/db");
const { tg, BOT_TOKEN } = require("../lib/telegram");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  const action = req.query.action || "";
  const method = req.method;

  try {
    /* ---------- نظرة عامة ---------- */
    if (action === "overview" && method === "GET") {
      const [chans, msgs, reqs, users] = await Promise.all([
        db("channels", { query: "?select=id&archived=eq.false" }),
        db("contact_messages", { query: "?select=id&status=eq.new" }),
        db("managed_chats", { query: "?select=chat_id&status=eq.pending" }),
        db("bot_users", { query: "?select=telegram_id" })
      ]);
      return res.status(200).json({
        channels: chans.data?.length || 0,
        newMessages: msgs.data?.length || 0,
        pendingRequests: reqs.data?.length || 0,
        totalUsers: users.data?.length || 0
      });
    }

    if (action === "verify" && method === "GET") {
      return res.status(200).json({ ok: true, user: req.adminUser });
    }

    /* ---------- القنوات ---------- */
    if (action === "channels" && method === "GET") {
      let query = "?select=*&order=sort_order.asc";
      if (req.query.category) query += `&category=eq.${req.query.category}`;
      const result = await db("channels", { query });
      let rows = result.data || [];
      if (req.query.q) {
        const q = req.query.q.toLowerCase();
        rows = rows.filter((c) => (c.name || "").toLowerCase().includes(q) || (c.description || "").toLowerCase().includes(q) || (c.url || "").toLowerCase().includes(q));
      }
      return res.status(200).json(rows);
    }
    if (action === "channels" && method === "POST") {
      const result = await db("channels", { method: "POST", body: req.body });
      return res.status(200).json({ ok: !result.error, data: result.data });
    }
    if (action === "channel" && method === "PATCH") {
      const result = await db("channels", { method: "PATCH", query: `?id=eq.${req.query.id}`, body: req.body });
      return res.status(200).json({ ok: !result.error });
    }
    if (action === "channel" && method === "DELETE") {
      const result = await db("channels", { method: "DELETE", query: `?id=eq.${req.query.id}` });
      return res.status(200).json({ ok: !result.error });
    }
    if (action === "channels-bulk" && method === "POST") {
      const { ids, field, value } = req.body || {};
      const allowedFields = ["archived", "category", "posts_mode", "is_featured"];
      if (!Array.isArray(ids) || !ids.length || !allowedFields.includes(field)) {
        return res.status(400).json({ error: "محتاج ids[] و field صحيح" });
      }
      let done = 0;
      for (const id of ids) {
        const result = await db("channels", { method: "PATCH", query: `?id=eq.${id}`, body: { [field]: value } });
        if (!result.error) done++;
      }
      return res.status(200).json({ ok: true, updated: done, total: ids.length });
    }
    if (action === "channels-export" && method === "GET") {
      const result = await db("channels", { query: "?select=*&order=sort_order.asc" });
      const rows = result.data || [];
      const header = "id,name,category,url,subscriber_count,archived,posts_mode";
      const csv = [header, ...rows.map((r) =>
        [r.id, r.name, r.category, r.url, r.subscriber_count ?? "", r.archived, r.posts_mode].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")
      )].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=channels.csv");
      return res.status(200).send("\uFEFF" + csv);
    }
    if (action === "channels-import" && method === "POST") {
      const rows = req.body?.rows;
      if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: "محتاج rows[]" });
      let created = 0, failed = 0;
      for (const row of rows) {
        if (!row.name || !row.url) { failed++; continue; }
        const result = await db("channels", { method: "POST", body: { name: row.name, url: row.url, category: row.category || "quran", description: row.description || null } });
        if (result.error) failed++; else created++;
      }
      return res.status(200).json({ ok: true, created, failed });
    }
    if (action === "channels-check-admin" && method === "GET") {
      const me = await tg("getMe", {});
      if (!me.ok) return res.status(500).json({ error: "تعذّر التحقق من هوية البوت" });
      const botId = me.result.id;
      const chatsRes = await db("managed_chats", { query: "?status=eq.approved&select=chat_id,title" });
      const results = [];
      for (const row of chatsRes.data || []) {
        const member = await tg("getChatMember", { chat_id: row.chat_id, user_id: botId });
        const healthy = member.ok && ["administrator", "creator"].includes(member.result.status);
        results.push({ chat_id: row.chat_id, title: row.title, healthy });
        await db("channels", { method: "PATCH", query: `?chat_id=eq.${row.chat_id}`, body: { health: healthy } });
        if (!healthy) await db("managed_chats", { method: "PATCH", query: `?chat_id=eq.${row.chat_id}`, body: { status: "lost_access" } });
      }
      return res.status(200).json({ checked: results.length, unhealthy: results.filter((r) => !r.healthy), results });
    }

    /* ---------- الرسائل ---------- */
    if (action === "messages" && method === "GET") {
      const result = await db("contact_messages", { query: "?select=*&order=created_at.desc&limit=100" });
      return res.status(200).json(result.data || []);
    }
    if (action === "message" && method === "PATCH") {
      const result = await db("contact_messages", { method: "PATCH", query: `?id=eq.${req.query.id}`, body: req.body });
      return res.status(200).json({ ok: !result.error });
    }

    /* ---------- طلبات اعتماد القنوات ---------- */
    if (action === "requests" && method === "GET") {
      const result = await db("managed_chats", { query: "?status=eq.pending&select=*&order=added_at.desc" });
      return res.status(200).json(result.data || []);
    }
    if (action === "request" && method === "POST") {
      const { chatId, decision } = req.query;
      if (!["approve", "reject"].includes(decision)) return res.status(400).json({ error: "invalid decision" });
      const status = decision === "approve" ? "approved" : "rejected";
      const result = await db("managed_chats", { method: "PATCH", query: `?chat_id=eq.${chatId}`, body: { status, approved_at: new Date().toISOString() } });
      return res.status(200).json({ ok: !result.error });
    }

    /* ---------- المستخدمين ---------- */
    if (action === "users" && method === "GET") {
      const q = req.query.q ? `&or=(username.ilike.*${req.query.q}*,first_name.ilike.*${req.query.q}*)` : "";
      const result = await db("bot_users", { query: `?select=*&order=last_active.desc&limit=200${q}` });
      return res.status(200).json(result.data || []);
    }
    if (action === "users-export" && method === "GET") {
      const filter = req.query.tag ? `&manual_tag=eq.${req.query.tag}` : "";
      const result = await db("bot_users", { query: `?select=telegram_id,username,first_name,manual_tag,joined_at${filter}` });
      const rows = result.data || [];
      const csv = ["telegram_id,username,first_name,manual_tag,joined_at", ...rows.map((r) => `${r.telegram_id},${r.username || ""},${r.first_name || ""},${r.manual_tag || ""},${r.joined_at}`)].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", "attachment; filename=users.csv");
      return res.status(200).send("\uFEFF" + csv);
    }
    if (action === "user" && method === "GET") {
      const id = req.query.id;
      const [userRes, chatsRes, activityRes] = await Promise.all([
        db("bot_users", { query: `?telegram_id=eq.${id}&select=*` }),
        db("managed_chats", { query: "?status=eq.approved&select=chat_id,title" }),
        db("user_activity_daily", { query: `?telegram_id=eq.${id}&select=*&order=activity_date.desc&limit=30` })
      ]);
      const user = userRes.data?.[0];
      if (!user) return res.status(404).json({ error: "مش موجود" });

      const memberOf = [];
      for (const row of chatsRes.data || []) {
        const member = await tg("getChatMember", { chat_id: row.chat_id, user_id: Number(id) });
        if (member.ok && ["member", "administrator", "creator"].includes(member.result.status)) memberOf.push(row.title);
      }

      const allActivity = await db("user_activity_daily", { query: "?select=event_count" });
      const avgActivity = allActivity.data?.length ? (allActivity.data.reduce((s, r) => s + r.event_count, 0) / allActivity.data.length).toFixed(1) : null;
      const myActivity = activityRes.data?.reduce((s, r) => s + r.event_count, 0) || 0;

      return res.status(200).json({ ...user, memberOf, activity: activityRes.data || [], avgActivity, myActivityTotal: myActivity });
    }
    if (action === "user" && method === "PATCH") {
      const result = await db("bot_users", { method: "PATCH", query: `?telegram_id=eq.${req.query.id}`, body: req.body });
      return res.status(200).json({ ok: !result.error });
    }
    if (action === "user-message" && method === "POST") {
      const result = await tg("sendMessage", { chat_id: req.query.id, text: req.body.text });
      if (!result.ok) return res.status(502).json({ error: "المستخدم مغلق البوت أو رقمه غلط" });
      return res.status(200).json({ ok: true });
    }
    if (action === "user-ban" && method === "POST") {
      const chatsRes = await db("managed_chats", { query: "?status=eq.approved&select=chat_id" });
      let done = 0, failed = 0;
      for (const row of chatsRes.data || []) {
        const result = await tg("banChatMember", { chat_id: row.chat_id, user_id: Number(req.query.id) });
        if (result.ok) done++; else failed++;
      }
      return res.status(200).json({ ok: true, done, failed });
    }
    if (action === "user-report" && method === "POST") {
      const cur = await db("bot_users", { query: `?telegram_id=eq.${req.query.id}&select=reported_count` });
      const count = (cur.data?.[0]?.reported_count || 0) + 1;
      await db("bot_users", { method: "PATCH", query: `?telegram_id=eq.${req.query.id}`, body: { reported_count: count } });
      return res.status(200).json({ ok: true, reported_count: count });
    }

    res.status(404).json({ error: "action غير معروف: " + action });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};
