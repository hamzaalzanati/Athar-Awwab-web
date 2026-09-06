const { db } = require("../lib/db");

// المعاينة هنا Snapshot ثابت يكتبه الأدمن يدويًا من لوحة التحكم
// (جدول previews)، مش أرشيف تلقائي لآخر منشورات القناة الحية.
// راجع migrations/003_previews.sql للسبب.
module.exports = async (req, res) => {
  const username = (req.query.username || "").replace("@", "");
  if (!username) return res.status(400).json({ error: "محتاج ?username=" });

  const chRes = await db("channels", { query: `?url=eq.https://t.me/${username}&select=id` });
  const channelId = chRes.data?.[0]?.id;
  if (!channelId) return res.status(200).json({ posts: [] });

  const prevRes = await db("previews", { query: `?channel_id=eq.${channelId}&select=*` });
  const p = prevRes.data?.[0];
  if (!p) return res.status(200).json({ posts: [] });

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  res.status(200).json({
    posts: [{
      text: p.text || null,
      media_type: p.media_type === "photo" ? "photo" : null,
      media_url: p.media_type === "photo" ? p.image_url : null,
      message_link: p.original_link || `https://t.me/${username}`
    }]
  });
};
