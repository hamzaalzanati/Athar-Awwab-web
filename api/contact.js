/* =========================================================
   api/contact.js — Vercel Serverless Function
   =========================================================
   يستقبل رسائل نموذج "تواصل معنا" من الموقع ويحوّلها فورًا لرسالة
   تليجرام تجيلك مباشرة — بدل نظام إيميل تقليدي (زي ما طلبت بالظبط).

   الإعداد المطلوب (مرة واحدة بس):
   1) اعمل بوت جديد من BotFather على تليجرام (أو استخدم بوت موجود عندك
      خاص بالإدارة) وخد التوكن بتاعه.
   2) ابعت أي رسالة للبوت من حسابك الشخصي، بعدين افتح في المتصفح:
      https://api.telegram.org/bot<التوكن>/getUpdates
      وهتلاقي رقم "chat":{"id": ...} — ده الـ Chat ID بتاعك.
   3) في إعدادات المشروع على Vercel: Settings > Environment Variables
      ضيف متغيرين:
        BOT_TOKEN      = توكن البوت
        ADMIN_CHAT_ID  = الـ Chat ID اللي طلع فوق
   4) اعمل Redeploy للمشروع عشان المتغيرات الجديدة تتفعّل.
   بعد كده أي رسالة من الموقع هتوصلك على تليجرام فورًا.
   ========================================================= */

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const { BOT_TOKEN, ADMIN_CHAT_ID } = process.env;
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) {
    res.status(503).json({ error: "بوت التواصل لسه متعملوش إعداد (شوف تعليمات أعلى الملف)" });
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }

  const name = ((body && body.name) || "").toString().slice(0, 120).trim();
  const message = ((body && body.message) || "").toString().slice(0, 1500).trim();
  const contact = ((body && body.contact) || "").toString().slice(0, 150).trim();

  if (!name || !message) {
    res.status(400).json({ error: "الاسم والرسالة مطلوبين" });
    return;
  }

  const text =
    `رسالة جديدة من موقع أثر أواب\n\n` +
    `الاسم: ${name}\n` +
    (contact ? `للتواصل: ${contact}\n` : "") +
    `\nالرسالة:\n${message}`;

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text })
    });
    const tgJson = await tgRes.json();
    if (!tgJson.ok) throw new Error("telegram api error: " + JSON.stringify(tgJson));
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(502).json({ error: "تعذر إرسال الرسالة، جرب تواصل مباشر عبر تليجرام" });
  }
};
