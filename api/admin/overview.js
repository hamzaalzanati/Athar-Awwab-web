const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const [chans, msgs, reqs, users] = await Promise.all([
    db("channels", { query: "?select=id&archived=eq.false" }),
    db("contact_messages", { query: "?select=id&status=eq.new" }),
    db("managed_chats", { query: "?select=chat_id&status=eq.pending" }),
    db("bot_users", { query: "?select=telegram_id" })
  ]);
  res.status(200).json({
    channels: chans.data?.length || 0,
    newMessages: msgs.data?.length || 0,
    pendingRequests: reqs.data?.length || 0,
    totalUsers: users.data?.length || 0
  });
};
