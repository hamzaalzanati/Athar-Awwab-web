const { db } = require("../_lib/db");
const { tg, BOT_TOKEN } = require("../_lib/telegram");

module.exports = async (req, res) => {
  const username = (req.query.username || "").replace("@", "");
  if (!username) return res.status(400).json({ error: "محتاج ?username=" });

  const chRes = await db("channels", { query: `?url=eq.https://t.me/${username}&select=chat_id` });
  const chatId = chRes.data?.[0]?.chat_id;
  if (!chatId) return res.status(200).json({ posts: [] });

  const postsRes = await db("channel_posts", { query: `?chat_id=eq.${chatId}&select=*&order=posted_at.desc&limit=3` });
  const posts = postsRes.data || [];

  const resolved = await Promise.all(posts.map(async (p) => {
    let mediaUrl = null;
    if (p.media_file_id) {
      const file = await tg("getFile", { file_id: p.media_file_id });
      if (file.ok) mediaUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${file.result.file_path}`;
    }
    return {
      text: p.post_text,
      media_type: p.media_type,
      media_url: mediaUrl,
      message_link: `https://t.me/${username}/${p.message_id}`
    };
  }));

  res.status(200).json({ posts: resolved });
};
