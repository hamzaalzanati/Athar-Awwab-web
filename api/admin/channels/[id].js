const { requireAdmin } = require("../../_lib/auth");
const { db } = require("../../_lib/db");

module.exports = async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const { id } = req.query;

  if (req.method === "PATCH") {
    const result = await db("channels", { method: "PATCH", query: `?id=eq.${id}`, body: req.body });
    return res.status(200).json({ ok: !result.error });
  }
  if (req.method === "DELETE") {
    const result = await db("channels", { method: "DELETE", query: `?id=eq.${id}` });
    return res.status(200).json({ ok: !result.error });
  }
  res.status(405).json({ error: "method not allowed" });
};
