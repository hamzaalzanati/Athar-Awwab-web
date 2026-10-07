// استيراد قوائم جاهزة (للأدمن): سطر لكل عنصر، الحقول مفصولة بـ |  — دوال نقية مختبرة.
import { normalizeAr } from "./normalize.js";
import { httpUrl, ValidationError } from "./validate.js";

export const MAX_LINES = 200;
const n = (s) => normalizeAr(String(s ?? "")).trim();

const TYPE = { قناه: "channel", channel: "channel", بوت: "bot", bot: "bot", جروب: "group", group: "group", مجموعه: "group",
  ملصقات: "sticker_pack", ملصق: "sticker_pack", sticker: "sticker_pack", stickers: "sticker_pack", sticker_pack: "sticker_pack" };
const REL = { "من مشروعنا": "own", مشروعنا: "own", own: "own", مساهمه: "contribution", "مساهمه في مشروع": "contribution", نساهم: "contribution", contribution: "contribution",
  مدعوم: "supported", مدعومه: "supported", "مشروع مدعوم": "supported", supported: "supported" };
const PROJ = { موقع: "website", مواقعنا: "website", website: "website", نساهم: "contributed", مساهمه: "contributed", contributed: "contributed",
  مدعوم: "supported", مدعومه: "supported", supported: "supported", ساعد: "help", مساعده: "help", help: "help" };

function lines(text) {
  const all = String(text ?? "").split(/\r?\n/).map((l, i) => ({ no: i + 1, raw: l.trim() })).filter((l) => l.raw && !l.raw.startsWith("#"));
  if (all.length > MAX_LINES) throw new ValidationError("too_many_lines");
  return all.map((l) => ({ no: l.no, cells: l.raw.slice(0, 600).split(/\||\t/).map((c) => c.trim()) }));
}

const USER = /^[A-Za-z0-9_]{3,64}$/;

/** categories: [{id, entity_type, label_ar}] */
export function parseEntities(text, categories) {
  const rows = [], problems = [], seen = new Set();
  for (const { no, cells } of lines(text)) {
    const [t, name, userRaw, catRaw, relRaw, desc] = cells;
    const type = TYPE[n(t)];
    if (!type) { problems.push({ line: no, reason: "نوع غير معروف (قناة/بوت/جروب/ملصقات)" }); continue; }
    if (!name || name.length > 120) { problems.push({ line: no, reason: "الاسم مطلوب (حتى 120 حرفًا)" }); continue; }
    const username = (userRaw ?? "").replace(/^@/, "").replace(/^https?:\/\/t\.me\//i, "").replace(/^addstickers\//i, "");
    if (username && !USER.test(username)) { problems.push({ line: no, reason: "اسم المستخدم غير صالح" }); continue; }
    if (type === "sticker_pack" && !username) { problems.push({ line: no, reason: "الملصقات تحتاج اسم الحزمة (آخر جزء من رابط addstickers)" }); continue; }
    let category_id = null;
    if (catRaw) {
      const pool = categories.filter((c) => c.entity_type === type);
      const exact = pool.filter((c) => n(c.label_ar) === n(catRaw));
      const loose = exact.length ? exact : pool.filter((c) => n(c.label_ar).includes(n(catRaw)));
      if (loose.length !== 1) { problems.push({ line: no, reason: `تصنيف غير موجود أو غير محدد: «${catRaw}»` }); continue; }
      category_id = loose[0].id;
    }
    let relationship = null;
    if (relRaw) {
      relationship = REL[n(relRaw)];
      if (!relationship) { problems.push({ line: no, reason: "علاقة غير معروفة (من مشروعنا/مساهمة/مدعوم)" }); continue; }
    }
    const key = `${type}:${username.toLowerCase() || n(name)}`;
    if (seen.has(key)) { problems.push({ line: no, reason: "مكرر في القائمة" }); continue; }
    seen.add(key);
    rows.push({ entity_type: type, name, telegram_username: username || null, category_id, relationship, short_description: desc ? desc.slice(0, 300) : null });
  }
  return { rows, problems };
}

export function parseProjects(text) {
  const rows = [], problems = [];
  for (const { no, cells } of lines(text)) {
    const [k, name, url, desc, exp] = cells;
    const kind = PROJ[n(k)];
    if (!kind) { problems.push({ line: no, reason: "نوع غير معروف (موقع/نساهم/مدعوم/ساعد)" }); continue; }
    if (!name || name.length < 2 || name.length > 120) { problems.push({ line: no, reason: "الاسم مطلوب (2 إلى 120 حرفًا)" }); continue; }
    let link = null;
    try { link = httpUrl(url); } catch { problems.push({ line: no, reason: "الرابط غير صالح (https:// فقط)" }); continue; }
    let expires_at = null;
    if (exp && kind === "help") { const t = Date.parse(exp); if (Number.isNaN(t)) { problems.push({ line: no, reason: "تاريخ الانتهاء غير صالح" }); continue; } expires_at = new Date(t).toISOString(); }
    rows.push({ kind, name, url: link, description: desc ? desc.slice(0, 500) : null, expires_at });
  }
  return { rows, problems };
}

export function parseSocial(text) {
  const rows = [], problems = [];
  for (const { no, cells } of lines(text)) {
    const [platform, label, url] = cells;
    if (!platform || platform.length > 30 || !label || label.length > 60) { problems.push({ line: no, reason: "المنصة والاسم مطلوبان" }); continue; }
    let link = null;
    try { link = httpUrl(url); } catch { /* handled below */ }
    if (!link) { problems.push({ line: no, reason: "الرابط مطلوب وبصيغة https://" }); continue; }
    rows.push({ platform, label, url: link });
  }
  return { rows, problems };
}
