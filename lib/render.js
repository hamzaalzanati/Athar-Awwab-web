import { TYPE_LABEL, TYPE_PATH, TYPE_PLURAL, JOIN_LABEL, RELATIONSHIP_LABEL, publicCount, hashString, formatTime } from "./labels.js";
import { PROJECT_START_YEAR } from "./project-age.js";

/** كل نص قادم من قاعدة البيانات أو من الزائر يمر من هنا قبل أن يدخل HTML. */
export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/** رابط http(s) فقط، وإلا null. */
export function safeUrl(u) {
  if (!u) return null;
  try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? p.toString() : null; } catch { return null; }
}

/** صورة: https أو مسار داخلي فقط. */
export function safeImg(u) {
  if (!u || typeof u !== "string" || /[\s"'<>()\\`]/.test(u)) return null;
  if (u.startsWith("/") && !u.startsWith("//") && !u.includes("..")) return u;
  return u.startsWith("https://") ? u : null;
}

const ICONS = {
  home: "M3 11l9-8 9 8M5 9.5V21h5v-6h4v6h5V9.5",
  compass: "M12 21a9 9 0 100-18 9 9 0 000 18zM15.5 8.5l-2 5-5 2 2-5z",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21M12 3C9.5 5.6 8.2 8.6 8.2 12S9.5 18.4 12 21",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  search: "M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3",
  close: "M6 6l12 12M18 6L6 18",
  send: "M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z",
  share: "M12 3v12M8 7l4-4 4 4M5 13v6a2 2 0 002 2h10a2 2 0 002-2v-6",
  link: "M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z",
  arrow: "M19 12H5M11 6l-6 6 6 6",
  external: "M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5",
  channel: "M4 6h16M4 12h10M4 18h16",
  bot: "M12 3v3M6 8h12a2 2 0 012 2v7a2 2 0 01-2 2H6a2 2 0 01-2-2v-7a2 2 0 012-2zM9 13h.01M15 13h.01M9 17h6",
  group: "M9 11a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 11a2.5 2.5 0 100-5M18 20a5 5 0 00-3-4.6",
  sticker: "M20 12a8 8 0 11-8-8h4l4 4zM16 4v4h4M9 14s1 2 3 2 3-2 3-2",
  play: "M8 5v14l11-7z",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",
  mic: "M12 15a3 3 0 003-3V6a3 3 0 00-6 0v6a3 3 0 003 3zM6 11a6 6 0 0012 0M12 17v4",
  image: "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9h.01",
};
export function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${ICONS[name] ?? ""}"/></svg>`;
}

const NAV = [
  { href: "/", label: "الرئيسية", icon: "home", match: (p) => p === "/" },
  { href: "/explore", label: "استكشف", icon: "compass", match: (p) => ["/explore", "/channels", "/bots", "/groups", "/stickers", "/search"].some((x) => p.startsWith(x)) },
  { href: "/websites", label: "مواقعنا", icon: "globe", match: (p) => p.startsWith("/websites") },
  { href: "/more", label: "المزيد", icon: "more", match: (p) => ["/more", "/about", "/contact", "/contribute", "/help"].some((x) => p.startsWith(x)) },
];

function siteUrl() { return (process.env.SITE_URL || "").replace(/\/$/, ""); }

export function layout({ title, description, path = "/", body, noindex = false, ogImage = "/images/og.jpg" }) {
  const base = siteUrl();
  const abs = (p) => (base ? base + p : p);
  const fullTitle = title ? `${esc(title)} — أثر أواب` : "أثر أواب — The Penitent's Legacy";
  const desc = esc(description || "نصنع أثرًا باقيًا... يبدأ بقلب عائد إلى الله. منصة رقمية غير ربحية لاكتشاف القنوات والبوتات والمشاريع الإسلامية النافعة.");
  const nav = NAV.map((n) => `<a href="${n.href}"${n.match(path) ? ' aria-current="page"' : ""}>${n.label}</a>`).join("");
  const bnav = NAV.map((n) => `<a href="${n.href}"${n.match(path) ? ' aria-current="page"' : ""}>${icon(n.icon, 22)}<span>${n.label}</span></a>`).join("");
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#000535">
<meta name="color-scheme" content="dark">
<title>${fullTitle}</title>
<meta name="description" content="${desc}">
${noindex ? '<meta name="robots" content="noindex, nofollow">' : ""}
${base ? `<link rel="canonical" href="${esc(base + path)}">` : ""}
<meta property="og:type" content="website"><meta property="og:locale" content="ar"><meta property="og:site_name" content="أثر أواب">
<meta property="og:title" content="${fullTitle}"><meta property="og:description" content="${desc}">
<meta property="og:image" content="${esc(abs(ogImage))}"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/icon.png"><link rel="apple-touch-icon" href="/apple-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Noto+Kufi+Arabic:wght@500;700;900&display=swap">
<link rel="stylesheet" href="/css/style.css">
</head>
<body>
<a href="#main" class="skip-link">تخطَّ إلى المحتوى</a>
<div class="shell">
<header class="header"><div class="wrap header-in">
  <a href="/" class="brand" aria-label="أثر أواب — الرئيسية"><img src="/images/logo.png" alt="" width="40" height="40"><span>أثر أواب</span></a>
  <nav class="nav-desktop" aria-label="التنقل الرئيسي">${nav}</nav>
  <form class="hsearch" role="search" action="/search" method="get" data-open="false">
    <button type="button" class="hs-open" aria-label="افتح البحث">${icon("search")}</button>
    <input type="search" name="q" placeholder="ابحث عن قناة أو بوت أو مشروع" aria-label="نص البحث" autocomplete="off" enterkeyhint="search" maxlength="100">
    <button type="submit" class="hs-go" aria-label="ابحث">${icon("search")}</button>
    <button type="button" class="hs-close" aria-label="إغلاق البحث">${icon("close", 18)}</button>
  </form>
</div></header>
${body}
<footer class="footer"><div class="wrap footer-in">
  <div><a href="/" class="brand"><img src="/images/logo.png" alt="" width="36" height="36" loading="lazy"><span>أثر أواب</span></a>
  <p style="margin-top:8px">مشروع دعوي رقمي غير ربحي منذ ${PROJECT_START_YEAR}.</p></div>
  <nav aria-label="روابط التذييل"><a href="/about">عن المشروع</a><a href="/explore">استكشف</a><a href="/websites">مواقعنا</a><a href="/contribute">ساهم</a><a href="/help">ساعد</a><a href="/contact">تواصل معنا</a></nav>
</div></footer>
<nav class="bnav" aria-label="التنقل السريع">${bnav}</nav>
</div>
<script src="/js/app.js" defer></script>
</body>
</html>`;
}

export function sectionHead(no, title, href, more = "عرض الكل") {
  return `<div class="sec-head"><span class="sec-no">${String(no).padStart(2, "0")}</span><h2 class="sec-title">${esc(title)}</h2>${
    href ? `<a href="${esc(href)}" class="sec-more">${esc(more)}${icon("arrow", 16)}</a>` : ""}</div>`;
}

/** صورة الكيان، وإن لم توجد تركيبة SVG تُولَّد من الاسم (لا شعار دائري). */
export function entityVisual(name, imageUrl, { eager = false } = {}) {
  const img = safeImg(imageUrl);
  if (img) return `<div class="evis"><img src="${esc(img)}" alt="" loading="${eager ? "eager" : "lazy"}" decoding="async"></div>`;
  const h = hashString(String(name));
  const n = 3 + (h % 3), shift = ((h >> 4) % 60) - 30;
  const initial = Array.from(String(name).trim())[0] ?? "";
  let arches = "";
  for (let i = 0; i < n; i++) {
    const w = 190 - i * 34, x = 100 - w / 2 + shift * (i / n), y = 60 + i * 26, o = (0.26 + i * 0.1).toFixed(2);
    arches += `<path d="M${x.toFixed(1)} 250V${y + w / 2}a${w / 2} ${w / 2} 0 0 1 ${w} 0V250" fill="none" stroke="#8fb0ff" stroke-opacity="${o}" stroke-width="1"/>`;
  }
  return `<div class="evis" aria-hidden="true"><svg viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice"><defs><linearGradient id="g${h}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1770"/><stop offset="1" stop-color="#000535"/></linearGradient></defs><rect width="200" height="250" fill="url(#g${h})"/>${arches}<text x="100" y="152" text-anchor="middle" font-size="64" font-weight="900" fill="#8fb0ff" fill-opacity=".9" style="font-family:'Noto Kufi Arabic',sans-serif">${esc(initial)}</text></svg></div>`;
}

export function card(e) {
  const href = `/${TYPE_PATH[e.entity_type] ?? "channels"}/${encodeURIComponent(e.slug)}`;
  const count = e.subscriber_count_hidden ? null : publicCount(e.subscriber_count);
  return `<a href="${href}" class="ecard"><div class="ecard-img">${entityVisual(e.name, e.image_url)}</div><div class="ecard-body">
<div class="ecard-kind">${esc(TYPE_LABEL[e.entity_type] ?? "")}</div><div class="ecard-name">${esc(e.name)}</div>${
    e.short_description ? `<div class="ecard-desc">${esc(e.short_description)}</div>` : ""}${count ? `<div class="ecard-count">${count}</div>` : ""}</div></a>`;
}

export function projectRows(items, { highlight = false } = {}) {
  return `<div class="plist">${items.map((p) => {
    const href = safeUrl(p.url);
    const inner = `<div class="prow-img">${entityVisual(p.name, p.image_url)}</div><div><div class="prow-t">${esc(p.name)}</div>${
      p.description ? `<div class="prow-s">${esc(p.description)}</div>` : ""}${
      highlight ? `<div class="prow-badge">حالة مؤقتة${p.expires_at ? ` — تنتهي ${esc(String(p.expires_at).slice(0, 10))}` : ""}</div>` : ""}</div>${href ? icon("external", 18) : ""}`;
    const cls = highlight ? "prow prow-hl" : "prow";
    return href ? `<a class="${cls}" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<div class="${cls}">${inner}</div>`;
  }).join("")}</div>`;
}

const OPP_KIND = { publishing: "نشر في قناة", bot: "بوت", account: "حساب تواصل", development: "برمجة وتطوير", other: "مساهمة" };
export function opportunityRows(items) {
  return `<div class="plist">${items.map((o) => {
    const ext = safeUrl(o.apply_url);
    const href = ext ?? `/contact?about=${encodeURIComponent(`مساهمة: ${o.title}`)}`;
    const inner = `<div style="min-width:0"><div class="ecard-kind">${esc(OPP_KIND[o.kind] ?? "مساهمة")}${o.target_label ? ` — ${esc(o.target_label)}` : ""}</div><div class="prow-t">${esc(o.title)}</div>${
      o.description ? `<div class="prow-s">${esc(o.description)}</div>` : ""}${
      o.expires_at ? `<div class="prow-s">آخر موعد: ${esc(String(o.expires_at).slice(0, 10))}</div>` : ""}</div>${icon(ext ? "external" : "arrow", 18)}`;
    return ext ? `<a class="prow" href="${esc(href)}" target="_blank" rel="noopener noreferrer">${inner}</a>` : `<a class="prow" href="${esc(href)}">${inner}</a>`;
  }).join("")}</div>`;
}

const WAVE = [8, 16, 11, 22, 14, 9, 20, 24, 12, 18, 8, 15, 21, 10, 17, 13, 22, 9, 14, 19];

function buttonRows(raw) {
  if (!Array.isArray(raw)) return [];
  const rows = [];
  for (const item of raw) {
    const cells = Array.isArray(item) ? item : [item];
    const labels = cells.map((c) => (c && typeof c.text === "string" ? c.text.slice(0, 40) : null)).filter(Boolean);
    if (labels.length) rows.push(labels.slice(0, 4));
  }
  return rows.slice(0, 6);
}

/** محاكاة مرئية لمنشورات تيليجرام (ليست WebView). الصور المصغّرة تُجلب عند الطلب من /api/media. */
export function telegramPreview(entity, messages) {
  const media = (m) => {
    const hasImg = (m.message_type === "photo" && m.file_id) || m.thumb_file_id || (m.message_type === "album" && Array.isArray(m.album_items) && m.album_items.length);
    if (!hasImg) return `<div class="tgm-media"><div class="tgm-ph">${icon("image", 34)}</div>${m.message_type === "video" ? `<div class="tgm-play"><span>${icon("play", 22)}</span></div>` : ""}</div>`;
    if (m.message_type === "album" && m.album_items.length > 1) {
      const n = Math.min(m.album_items.length, 10);
      const imgs = Array.from({ length: Math.min(n, 4) }, (_, i) => `<img src="/api/media?m=${m.id}&amp;i=${i}" alt="" loading="lazy" decoding="async">`).join("");
      return `<div class="tgm-media"><div class="tgm-album tgm-album-${Math.min(n, 4)}">${imgs}${n > 4 ? `<span class="tgm-more">+${n - 4}</span>` : ""}</div></div>`;
    }
    return `<div class="tgm-media"><img src="/api/media?m=${m.id}" alt="" loading="lazy" decoding="async">${m.message_type === "video" ? `<div class="tgm-play"><span>${icon("play", 22)}</span></div>` : ""}</div>`;
  };
  const items = messages.map((m) => {
    const body = m.text_content || m.caption;
    const time = formatTime(m.original_ts);
    const btns = buttonRows(m.buttons);
    const isMedia = ["photo", "video", "album"].includes(m.message_type);
    return `<article class="tgm">${isMedia ? media(m) : ""}${
      m.message_type === "audio" ? `<div class="tgm-file"><span class="tgm-file-ic">${icon("mic", 22)}</span><div style="flex:1"><b>مقطع صوتي</b><div class="tgm-wave">${WAVE.map((h) => `<i style="height:${h}px"></i>`).join("")}</div></div></div>` : ""}${
      m.message_type === "document" ? `<div class="tgm-file"><span class="tgm-file-ic">${icon("file", 22)}</span><div><b>ملف</b><small>يُفتح من تيليجرام</small></div></div>` : ""}${
      body ? `<p class="tgm-text">${esc(body)}</p>` : ""}${time ? `<div class="tgm-time">${time}</div>` : ""}${
      btns.length ? `<div class="tgm-btns" aria-hidden="true">${btns.map((r) => `<div class="tgm-btnrow">${r.map((t) => `<span class="tgm-btn">${esc(t)}</span>`).join("")}</div>`).join("")}</div>` : ""}${
      safeUrl(m.original_link) ? `<a class="tgm-open" href="${esc(safeUrl(m.original_link))}" target="_blank" rel="noopener noreferrer">فتح المنشور الأصلي ${icon("external", 14)}</a>` : ""}</article>`;
  }).join("");
  return `<div><div class="tgp" role="group" aria-label="معاينة منشورات ${esc(entity.name)}"><div class="tgp-bar"><span class="tgp-av">${entityVisual(entity.name, entity.image_url)}</span><span>${esc(entity.name)}</span></div><div class="tgp-feed">${items}</div></div><p class="tgp-note">محاكاة مرئية لمنشورات مختارة، وليست بثًا مباشرًا من القناة.</p></div>`;
}

export { TYPE_LABEL, TYPE_PATH, TYPE_PLURAL, JOIN_LABEL, RELATIONSHIP_LABEL, publicCount };

/** رابط الانضمام: الملصقات تُفتح عبر addstickers، وغيرها عبر اسم المستخدم. */
export function telegramJoinUrl(type, username, inviteUrl = null) {
  const u = String(username ?? "").replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{3,64}$/.test(u)) return /^https:\/\/t\.me\/\+[A-Za-z0-9_-]{8,40}$/.test(inviteUrl ?? "") ? inviteUrl : null; // القناة الخاصة: رابط الدعوة
  return type === "sticker_pack" ? `https://t.me/addstickers/${u}` : `https://t.me/${u}`;
}

/** تجميع الكيانات حسب التصنيف بترتيب التصنيفات، والكيانات بلا تصنيف في «أخرى» آخرًا، ولا مجموعة فارغة. */
export function groupByCategory(items, categories) {
  const byCat = new Map(categories.map((c) => [c.id, { id: c.id, label: c.label_ar, items: [] }]));
  const other = { id: "other", label: "أخرى", items: [] };
  for (const it of items) (byCat.get(it.category_id) ?? other).items.push(it);
  return [...byCat.values(), other].filter((g) => g.items.length > 0);
}
