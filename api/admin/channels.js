const { requireAdmin } = require("../_lib/auth");
const { db } = require("../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET") {
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

  if (req.method === "POST") {
    const result = await db("channels", { method: "POST", body: req.body });
    return res.status(200).json({ ok: !result.error, data: result.data });
  }

  res.status(405).json({ error: "method not allowed" });
};
