const { requireAdmin } = require("../_lib/auth");

module.exports = async (req, res) => {
  const user = requireAdmin(req, res);
  if (!user) return;
  res.status(200).json({ ok: true, user });
};
