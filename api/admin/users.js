const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const q = req.query.q ? `&or=(username.ilike.*${req.query.q}*,first_name.ilike.*${req.query.q}*)` : "";
  const result = await db("bot_users", { query: `?select=*&order=last_active.desc&limit=200${q}` });
  res.status(200).json(result.data || []);
};
