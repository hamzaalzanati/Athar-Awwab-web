import crypto from "node:crypto";

/**
 * التحقق من initData الخاص بتطبيق تيليجرام (على الخادم دائمًا، لا نثق بالمتصفح).
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyInitData(initData, botToken, { maxAgeSeconds = 86400, now = Date.now() } = {}) {
  if (!initData || !botToken || typeof initData !== "string" || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) return null;
  params.delete("hash");
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = crypto.createHmac("sha256", secret).update(check).digest();
  const given = Buffer.from(hash, "hex");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate) || now / 1000 - authDate > maxAgeSeconds || authDate - now / 1000 > 300) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "");
    if (!Number.isSafeInteger(user?.id)) return null;
    return { id: user.id, firstName: user.first_name ?? null, username: user.username ?? null };
  } catch { return null; }
}

const RANK = { editor: 1, admin: 2, owner: 3 };
/** الحد الأدنى للدور لكل إجراء في لوحة التحكم. */
export const ACTION_ROLE = {
  overview: "editor", "pending.list": "editor", "entity.approve": "editor", "entity.reject": "editor",
  "entities.list": "editor", "entity.update": "editor", "entity.create": "editor",
  "categories.list": "editor", "category.upsert": "admin",
  "projects.list": "editor", "project.upsert": "editor", "project.toggle": "editor",
  "opportunities.list": "editor", "opportunity.upsert": "editor", "opportunity.toggle": "editor",
  "social.list": "admin", "social.upsert": "admin", "social.toggle": "admin",
  "settings.get": "editor", "settings.set": "admin",
  "preview.start": "editor", "preview.status": "editor", "preview.save": "editor", "preview.cancel": "editor",
  "users.search": "admin", "contact.list": "admin", "audit.list": "admin",
  "sync.request": "admin", "zanati.ask": "admin", "import.run": "admin", "import.links": "admin",
  "analytics.get": "editor", "alert.ack": "admin",
  "admins.list": "owner", "admin.upsert": "owner", "admin.toggle": "owner",
  "user.update": "admin", "contact.mark": "admin", "contact.delete": "admin",
  "jobs.list": "admin", "job.retry": "admin", "job.cancel": "admin", "entity.syncs": "editor",
  "broadcast.preview": "admin", "broadcast.send": "admin",
};
export function roleAllows(role, action) {
  const need = ACTION_ROLE[action];
  return !!need && (RANK[role] ?? 0) >= RANK[need];
}
