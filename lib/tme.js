// استيراد من روابط تيليجرام: تصنيف الرابط، تحليل صفحة t.me العامة، واقتراح تصنيف. دوال نقية مختبرة.
// الخادم لا يجلب إلا https://t.me/... يبنيه بنفسه من اسم مستخدم أو دعوة مُتحقَّق منها (لا SSRF).
import { normalizeAr } from "./normalize.js";

const USER = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;
const INVITE = /^\+[A-Za-z0-9_-]{8,40}$/;
const PACK = /^[A-Za-z0-9_]{1,64}$/;

/** يحدد نوع الرابط. type: bot | sticker_pack | channel (قناة أو جروب يُحسم من الصفحة) | invite | social | unknown */
export function classifyLink(raw) {
  let u;
  try { u = new URL(String(raw).trim()); } catch { return { kind: "invalid" }; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return { kind: "invalid" };
  const host = u.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "t.me" || host === "telegram.me") {
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts[0] === "addstickers" && PACK.test(parts[1] ?? "")) return { kind: "sticker_pack", username: parts[1] };
    if (parts[0] === "joinchat" && parts[1]) return { kind: "invite", hash: `+${parts[1]}` };
    if (parts[0] && INVITE.test(parts[0])) return { kind: "invite", hash: parts[0] };
    if (parts[0] && USER.test(parts[0]) && parts.length <= 2) return /bot$/i.test(parts[0]) ? { kind: "bot", username: parts[0] } : { kind: "channel", username: parts[0] };
    return { kind: "invalid" };
  }
  const SOCIAL = [["whatsapp.com", "WhatsApp"], ["facebook.com", "Facebook"], ["fb.com", "Facebook"], ["instagram.com", "Instagram"], ["tiktok.com", "TikTok"],
    ["threads.com", "Threads"], ["threads.net", "Threads"], ["x.com", "X"], ["twitter.com", "X"], ["pinterest.com", "Pinterest"]];
  const s = SOCIAL.find(([d]) => host === d || host.endsWith(`.${d}`));
  return s ? { kind: "social", platform: s[1], url: u.toString() } : { kind: "unknown", url: u.toString() };
}

/** الرابط الذي سيجلبه الخادم (مبنيّ من أجزاء مُتحقَّق منها فقط). */
export function tmeFetchUrl(c) {
  if (c.kind === "invite") return `https://t.me/${c.hash}`;
  if (c.kind === "sticker_pack") return `https://t.me/addstickers/${c.username}`;
  if (c.kind === "bot" || c.kind === "channel") return `https://t.me/${c.username}`;
  return null;
}

/** نزيل الإيموجي والرموز الزخرفية غير المرئية من النصوص المستوردة (قاعدة الموقع: لا إيموجي). */
export const stripEmoji = (s) => String(s ?? "").replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u200B\u200E\u200F]/gu, "").replace(/\s+/g, " ").trim();

const decode = (s) => String(s ?? "")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const m = re.exec(html) ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*property=["']${prop}["']`, "i").exec(html);
  return m ? decode(m[1]) : null;
}

/** يحلل صفحة t.me العامة (بالإنجليزية): العنوان، الوصف، الصورة، العدد، ونوع الكيان إن أمكن. */
export function parseTmePage(html) {
  const h = String(html ?? "").slice(0, 400_000);
  const titleBlock = /<div class="tgme_page_title"[^>]*>([\s\S]*?)<\/div>/i.exec(h);
  const title = titleBlock ? decode(titleBlock[1].replace(/<[^>]+>/g, " ")) : meta(h, "og:title");
  const extra = /<div class="tgme_page_extra"[^>]*>([\s\S]*?)<\/div>/i.exec(h);
  const extraText = extra ? decode(extra[1].replace(/<[^>]+>/g, " ")) : "";
  const descBlock = /<div class="tgme_page_description"[^>]*>([\s\S]*?)<\/div>/i.exec(h);
  const description = descBlock ? decode(descBlock[1].replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")) : meta(h, "og:description");
  let image = meta(h, "og:image");
  if (image && (!/^https:\/\//.test(image) || /t_logo|telegram\.org\/img/.test(image))) image = null;

  let count = null, kind = "unknown";
  const cm = /([\d][\d\s.,]*)\s*(subscribers?|members?)/i.exec(extraText);
  if (cm) {
    count = Number(cm[1].replace(/[^\d]/g, "")) || null;
    kind = /subscriber/i.test(cm[2]) ? "channel" : "group";
  } else if (/^@/.test(extraText)) kind = "account"; // بوت أو مستخدم

  const invalid = !title || /^telegram:\s*(contact|join)/i.test(title) || /^telegram$/i.test(title.trim());
  const cleanTitle = invalid ? null : stripEmoji(title) || null;
  const cleanDesc = description && !/^you can (view and join|contact)/i.test(description) ? stripEmoji(description) || null : null;
  return { title: cleanTitle, description: cleanDesc,
    image, count, kind, resolved: !invalid };
}

// اقتراح التصنيف من النص (قواعد صريحة؛ لا يخمّن عند عدم التطابق ويترك الأمر للأدمن)
const RULES = {
  channel: [
    [/صفح[ةه]|صفحات|ورد|الصفحه/, "قنوات القرآن مقسم صفحات"],
    [/سير[ةه]|النبي|الرسول|محمد ﷺ|صلى الله عليه/, "قنوات السيرة النبوية"],
    [/تطوير|تحفيز|ذات|نجاح|عادات/, "قنوات تطوير ذات وتحفيز"],
    [/منبه|تنبيه|تذكير|اذكار|أذكار|استغفار|صلاة|صلاه/, "قنوات منبهات الدينية"],
    [/اقتباس|اقتباسات|أدب|ادب|خواطر|شعر/, "قنوات اقتباسات أدبية"],
    [/قرآن|قران|تلاو|مصحف|آية|اية|سور[ةه]/, "قنوات محتوى القرآن متنوع"],
  ],
  bot: [
    [/صفح[ةه]|صفحات/, "قرآن مقسم صفحات"], [/سير[ةه]|النبي/, "السيرة النبوية"], [/تطوير|تحفيز|ذات/, "تطوير ذات وتحفيز"],
    [/قرآن|قران|تلاو|مصحف|سور[ةه]|آية|اية/, "قرآن"],
  ],
};
export function suggestCategoryLabel(type, title, description) {
  if (type === "group") return "جروبات";
  if (type === "sticker_pack") return "ملصقات دينية";
  const text = `${title ?? ""} ${description ?? ""}`;
  const norm = normalizeAr(text);
  for (const [re, label] of RULES[type] ?? []) if (re.test(text) || re.test(norm)) return label;
  return null;
}

/** يبني صف كيان من نتيجة الجلب. categories: [{id,entity_type,label_ar}] */
export function buildEntityRow(link, page, categories) {
  const type = link.kind === "bot" ? "bot" : link.kind === "sticker_pack" ? "sticker_pack" : page?.kind === "group" ? "group" : "channel";
  const name = (page?.title ?? link.username ?? "").slice(0, 120) || null;
  if (!name) return null;
  const label = suggestCategoryLabel(type, page?.title, page?.description);
  const cat = label ? categories.find((c) => c.entity_type === type && normalizeAr(c.label_ar) === normalizeAr(label)) : null;
  const desc = page?.description ?? null;
  return {
    entity_type: type, name, tg_title: page?.title ?? null, tg_description: desc,
    short_description: desc ? desc.slice(0, 300) : null,
    telegram_username: link.username ?? null, invite_url: link.kind === "invite" ? `https://t.me/${link.hash}` : null,
    image_url: page?.image ?? null, subscriber_count: page?.count ?? null,
    category_id: cat?.id ?? null, relationship: "own",
  };
}

/** نص يُلصق خطأً (روابط متعددة في سطر، مسافات، علامات) → قائمة روابط نظيفة بلا تكرار. */
export function extractUrls(text, max = 400) {
  const found = String(text ?? "").match(/https?:\/\/[^\s<>"'،,]+/g) ?? [];
  const clean = found.map((u) => u.replace(/[)\].،,;]+$/, ""));
  return [...new Set(clean)].slice(0, max);
}
