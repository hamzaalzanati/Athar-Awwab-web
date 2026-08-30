const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = await db("managed_chats", { query: "?status=eq.pending&select=*&order=added_at.desc" });
  res.status(200).json(result.data || []);
};
