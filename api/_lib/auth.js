/* api/_lib/auth.js — نفس منطق التحقق من توقيع تليجرام، في مكان واحد
   تستخدمه كل نقاط API الخاصة بلوحة التحكم */
const crypto = require("crypto");

function verifyTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");
  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (computedHash !== hash) return null;
  const authDate = Number(params.get("auth_date") || 0);
  if (!authDate || Date.now() / 1000 - authDate > 3600) return null;
  try { return JSON.parse(params.get("user") || "null"); } catch (e) { return null; }
}

/* يرجع بيانات الأدمن لو التحقق نجح، أو null بعد ما يبعت 403 بنفسه */
function requireAdmin(req, res) {
  const initData = req.headers["x-telegram-init-data"] || "";
  const { BOT_TOKEN, ADMIN_IDS } = process.env;
  const allowed = (ADMIN_IDS || "").split(",").map((s) => s.trim());

  const user = verifyTelegramInitData(initData, BOT_TOKEN);
  if (!user || !allowed.includes(String(user.id))) {
    res.status(403).json({ error: "غير مصرّح — الوصول متاح فقط لحسابات الأدمن المعتمدة" });
    return null;
  }
  return user;
}

module.exports = { requireAdmin, verifyTelegramInitData };
