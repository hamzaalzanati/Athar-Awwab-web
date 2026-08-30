const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const result = await db("contact_messages", { query: "?select=*&order=created_at.desc&limit=100" });
  res.status(200).json(result.data || []);
};
