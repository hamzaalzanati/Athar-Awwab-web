import { telegramJoinUrl, groupByCategory, layout, esc, safeUrl, safeImg, icon, sectionHead, card, projectRows, opportunityRows, telegramPreview, entityVisual,
  TYPE_LABEL, TYPE_PATH, TYPE_PLURAL, JOIN_LABEL, RELATIONSHIP_LABEL, publicCount } from "./render.js";
import { PROJECT_START_YEAR, projectAgeYears, yearsPhrase } from "./project-age.js";

const DEFAULT_HERO = "/images/hero.jpg";

/** أولوية صورة الواجهة: إعداد لوحة التحكم ثم HERO_IMAGE_URL ثم الملف داخل المشروع. */
export function resolveHero(adminValue, env = process.env.HERO_IMAGE_URL) {
  return safeImg(adminValue) ?? safeImg(env?.trim()) ?? DEFAULT_HERO;
}

const main = (inner) => `<main id="main">${inner}</main>`;
const wrapMain = (inner) => `<main id="main" class="wrap">${inner}</main>`;
const pageHead = (h1, p) => `<div class="page-head"><h1>${esc(h1)}</h1>${p ? `<p>${esc(p)}</p>` : ""}</div>`;

export function homePage(d) {
  const age = projectAgeYears();
  const ageText = age > 0 ? `بدأ المشروع، وله اليوم ${yearsPhrase(age)} من العمل.` : "بدأ المشروع هذا العام.";
  const hero = resolveHero(d.settings.heroImageUrl);
  const stats = [
    [d.counts.channels, "قناة تيليجرام"], [d.counts.bots, "بوت"], [d.counts.groups, "جروب"],
    [d.counts.stickers, "مجموعة ملصقات"], [d.counts.websites, "موقع"], [d.settings.botUsersTotal, "مستخدم للبوتات"],
  ].filter(([n]) => n > 0);
  const quick = [
    ["/channels", "القنوات", "قرآن وسيرة وتطوير ذات", "channel", d.counts.channels],
    ["/bots", "البوتات", "محتوى ونشر", "bot", d.counts.bots],
    ["/groups", "الجروبات", "مجتمعات للنقاش", "group", d.counts.groups],
    ["/stickers", "الملصقات", "ملصقات دينية", "sticker", d.counts.stickers],
  ].filter((q) => q[4] > 0);

  let no = 1;
  const sections = [];
  const sec = (inner) => sections.push(`<section class="wrap section" data-reveal-on-scroll>${inner}</section>`);

  sec(`${sectionHead(no++, "عن المشروع", "/about", "اقرأ المزيد")}<div class="about"><p class="display" style="font-size:24px;font-weight:800;line-height:1.6">منظومة رقمية واحدة لكل ما نصنعه وندعمه.</p><p>أثر أواب مشروع دعوي رقمي غير ربحي بدأ عام ${PROJECT_START_YEAR}. ينظّم قنوات وبوتات وجروبات تيليجرام، ومجموعات ملصقات دينية، ومواقع ومشاريع مستقلة نساهم فيها أو ندعمها.</p></div>`);
  if (quick.length) sec(`${sectionHead(no++, "وصول سريع")}<div class="quick">${quick.map(([h, l, s, i]) => `<a href="${h}">${icon(i, 26)}<div><b>${l}</b><br><small>${s}</small></div></a>`).join("")}</div>`);
  if (d.fresh.length) sec(`${sectionHead(no++, "جديدنا", "/explore")}<div class="rail">${d.fresh.map(card).join("")}</div>`);
  if (d.followed.length) sec(`${sectionHead(no++, "الأكثر متابعة", "/channels")}<div class="rail">${d.followed.map(card).join("")}</div>`);
  sec(`${sectionHead(no++, "استكشف المشروع")}<div class="about"><p>ابحث بالاسم أو الموضوع، أو تصفّح حسب النوع.</p><div class="hero-cta" style="margin-top:0"><a href="/explore" class="btn btn-primary">تصفّح الكل ${icon("arrow", 18)}</a><a href="/search" class="btn btn-ghost">${icon("search", 18)}ابحث</a></div></div>`);
  for (const [title, items, href] of [["مواقعنا", d.websites, "/websites"], ["مشاريع نساهم فيها", d.contributed], ["مشاريع مدعومة", d.supported]]) {
    if (items.length) sec(`${sectionHead(no++, title, href)}${projectRows(items)}`);
  }
  if (d.opportunities.length) sec(`${sectionHead(no++, "ساهم", "/contribute", "كل الفرص")}<p class="hint-text">أعمال مفتوحة تحتاج من يشاركنا فيها.</p>${opportunityRows(d.opportunities)}`);
  if (d.help.length) sec(`${sectionHead(no++, "ساعد", "/help", "كل الحالات")}<p class="hint-text">حالات من متابعينا تحتاج مساعدة، راجعها الفريق. المساعدة اختيارية وتتم عبر الجهة المذكورة في كل حالة، وليس عبر هذا الموقع.</p>${projectRows(d.help, { highlight: true })}`);
  const social = d.social.map((s) => ({ ...s, u: safeUrl(s.url) })).filter((s) => s.u);
  if (social.length) sec(`${sectionHead(no++, "تابعنا")}<div class="social">${social.map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${icon("external", 16)}${esc(s.label)}</a>`).join("")}</div>`);

  const body = main(`
<section class="hero hero-img" aria-labelledby="hero-title">
  <div class="hero-bg" aria-hidden="true"><img src="${esc(hero)}" alt="" fetchpriority="high" decoding="async"></div>
  <div class="wrap hero-in">
    <p class="hero-eyebrow">مشروع دعوي رقمي غير ربحي</p>
    <h1 id="hero-title">أثر أواب</h1>
    <p class="hero-slogan">نصنع أثرًا باقيًا... يبدأ بقلب عائد إلى الله</p>
    <div class="hero-cta"><a href="/explore" class="btn btn-primary">استكشف المشروع ${icon("arrow", 18)}</a><a href="/about" class="btn btn-ghost">عن أثر أواب</a></div>
    <div class="hero-year"><b>${PROJECT_START_YEAR}</b><span>${esc(ageText)}</span></div>
  </div>
</section>
${stats.length ? `<section class="wrap stats" aria-label="أرقام المشروع">${stats.map(([n, l]) => `<div class="stat"><b>${n.toLocaleString("en-US")}</b><span>${l}</span></div>`).join("")}</section>` : ""}
${sections.join("")}`);
  return layout({ title: "", path: "/", body });
}

export function explorePage({ counts, websites, contributed, supported, social }, categories = []) {
  const types = [["/channels", "القنوات", "channel", counts.channels], ["/bots", "البوتات", "bot", counts.bots],
    ["/groups", "الجروبات", "group", counts.groups], ["/stickers", "الملصقات الدينية", "sticker", counts.stickers]].filter((t) => t[3] > 0);
  let no = 1;
  const parts = [];
  if (types.length) parts.push(`<section class="section">${sectionHead(no++, "على تيليجرام")}<div class="quick">${types.map(([h, l, i, n]) => `<a href="${h}">${icon(i, 26)}<div><b>${l}</b><br><small>${n.toLocaleString("en-US")} عنصر</small></div></a>`).join("")}</div></section>`);
  if (categories.length) {
    parts.push(`<section class="section">${sectionHead(no++, "التصنيفات")}<div class="plist">${categories.map((c) =>
      `<a class="prow" href="/${TYPE_PATH[c.entity_type]}#cat-${esc(c.id)}"><div><div class="ecard-kind">${esc(TYPE_PLURAL[c.entity_type])}</div><div class="prow-t">${esc(c.label_ar)}</div></div><span class="prow-s" style="margin-inline-start:auto">${c.count.toLocaleString("en-US")}</span>${icon("arrow", 18)}</a>`).join("")}</div></section>`);
  }
  for (const [t, items, href] of [["مواقعنا", websites, "/websites"], ["مشاريع نساهم فيها", contributed], ["مشاريع مدعومة", supported]]) {
    if (items.length) parts.push(`<section class="section">${sectionHead(no++, t, href)}${projectRows(items)}</section>`);
  }
  const soc = social.map((s) => ({ ...s, u: safeUrl(s.url) })).filter((s) => s.u);
  if (soc.length) parts.push(`<section class="section">${sectionHead(no++, "منصات التواصل")}<div class="social">${soc.map((s) => `<a href="${esc(s.u)}" target="_blank" rel="noopener noreferrer">${icon("external", 16)}${esc(s.label)}</a>`).join("")}</div></section>`);
  return layout({ title: "استكشف", path: "/explore", body: wrapMain(pageHead("استكشف", "تصفّح ما في المشروع حسب النوع، أو ابدأ بالبحث.") + parts.join("")) });
}

export function listPage(type, items, categories = []) {
  const title = TYPE_PLURAL[type];
  const groups = groupByCategory(items, categories);
  const chips = groups.length > 1 ? `<nav class="catnav" aria-label="التصنيفات">${groups.map((g) => `<a href="#cat-${esc(g.id)}">${esc(g.label)}<span>${g.items.length.toLocaleString("en-US")}</span></a>`).join("")}</nav>` : "";
  const sections = groups.map((g, i) => `<section class="section" id="cat-${esc(g.id)}">${groups.length > 1 || g.id !== "other" ? sectionHead(i + 1, g.label) : ""}<div class="egrid">${g.items.map(card).join("")}</div></section>`).join("");
  const body = wrapMain(`${pageHead(title, items.length ? `${items.length.toLocaleString("en-US")} عنصر` : "")}${chips}${items.length ? sections : `<div class="empty"><p>لا توجد عناصر منشورة حاليًا.</p></div>`}`);
  return layout({ title, path: `/${TYPE_PATH[type]}`, body });
}

export function entityPage(result, type) {
  const { entity: e, categoryLabel, previews } = result;
  const username = e.telegram_username?.replace(/^@/, "");
  const joinUrl = telegramJoinUrl(type, username, e.invite_url);
  const path = `/${TYPE_PATH[type]}/${encodeURIComponent(e.slug)}`;
  const count = e.subscriber_count_hidden ? null : publicCount(e.subscriber_count);
  const fns = type === "bot" ? (e.bot_functions ?? []).map((f) => (f === "content" ? "بوت محتوى" : "بوت نشر")) : [];
  const tags = [TYPE_LABEL[type], categoryLabel, e.relationship ? RELATIONSHIP_LABEL[e.relationship] : null, ...fns].filter(Boolean);
  const desc = e.long_description || e.short_description;
  const body = `<main id="main" class="edetail">
<div class="edetail-hero">${entityVisual(e.name, e.image_url, { eager: true })}</div>
<div class="wrap edetail-top">
  <div>
    <nav class="crumbs" aria-label="مسار التصفح"><a href="/explore">استكشف</a><span aria-hidden="true">/</span><a href="/${TYPE_PATH[type]}">${esc(TYPE_PLURAL[type])}</a></nav>
    <h1>${esc(e.name)}</h1>${username && type !== "sticker_pack" ? `<p class="handle">@${esc(username)}</p>` : ""}
    <div class="tags">${tags.map((t) => `<span class="tag">${esc(t)}</span>`).join("")}</div>
    ${count ? `<div class="meta-row"><div><b>${count}</b><span>${type === "group" ? "عضو" : "متابع"}</span></div></div>` : ""}
    ${desc ? `<p class="edesc">${esc(desc)}</p>` : ""}
  </div>
  <div>
    ${joinUrl ? `<div class="eactions" data-entity="${esc(e.id)}" data-path="${esc(path)}" data-title="${esc(e.name)}" data-join="${esc(joinUrl)}">
      <a class="btn btn-primary btn-block" href="${esc(joinUrl)}" target="_blank" rel="noopener noreferrer" data-join-link>${icon("send", 20)}${esc(JOIN_LABEL[type])}</a>
      <div class="eactions-sec"><button type="button" data-act="share">${icon("share", 18)}مشاركة</button><button type="button" data-act="copy">${icon("link", 18)}نسخ الرابط</button><button type="button" data-act="qr" aria-expanded="false">${icon("qr", 18)}QR</button></div>
      <p role="status" aria-live="polite" data-notice style="min-height:20px;font-size:13px;color:var(--accent)"></p>
      <div class="qr" data-qr hidden><img alt="رمز QR لفتح ${esc(e.name)} في تيليجرام" width="180" height="180" style="background:#fff;border-radius:8px"><small>امسح الرمز لفتح الرابط في تيليجرام</small></div>
    </div>` : ""}
    ${previews.length ? `<div style="margin-top:32px">${telegramPreview(e, previews)}</div>` : ""}
  </div>
</div></main>`;
  return layout({ title: e.name, description: e.short_description || e.long_description?.slice(0, 160), path, body,
    ogImage: safeImg(e.image_url) && e.image_url.startsWith("https://") ? e.image_url : "/images/og.jpg" });
}

export function searchPage(q, results) {
  const body = wrapMain(`<div class="page-head"><h1>البحث</h1><form action="/search" method="get" role="search" class="field" style="margin-top:18px;max-width:560px"><label for="q" class="sr-only">نص البحث</label><input id="q" type="search" name="q" value="${esc(q)}" placeholder="ابحث عن قناة أو بوت أو مشروع" maxlength="100"></form></div>${
    !q ? `<p class="empty">اكتب كلمة للبحث في القنوات والبوتات والجروبات والملصقات.</p>`
    : results.length === 0 ? `<div class="empty"><p>لا نتائج لـ «${esc(q)}».</p><p style="font-size:13px;margin-top:6px">جرّب كلمة أخرى أو تأكد من الإملاء.</p></div>`
    : `<div class="plist" style="margin-top:18px"><p style="font-size:13px;color:var(--ink-3);padding:10px 0">${results.length.toLocaleString("en-US")} نتيجة</p>${results.map((r) =>
        `<a class="prow" href="/${TYPE_PATH[r.entity_type] ?? "channels"}/${encodeURIComponent(r.slug)}"><div class="prow-img">${entityVisual(r.name, r.image_url)}</div><div><div class="prow-t">${esc(r.name)}</div><div class="prow-s">${esc(TYPE_LABEL[r.entity_type] ?? "")}${r.short_description ? ` — ${esc(r.short_description)}` : ""}</div></div></a>`).join("")}</div>`}`);
  return layout({ title: q ? `بحث: ${q}` : "البحث", path: "/search", body, noindex: true });
}

export function websitesPage(items) {
  return layout({ title: "مواقعنا", path: "/websites", body: wrapMain(pageHead("مواقعنا", "المواقع والتطبيقات التي يملكها أثر أواب مباشرة.") +
    (items.length ? `<div style="margin-top:22px">${projectRows(items)}</div>` : `<div class="empty"><p>لا توجد مواقع منشورة حاليًا.</p></div>`)) });
}

export function contributePage(items) {
  return layout({ title: "ساهم معنا", path: "/contribute", body: wrapMain(pageHead("ساهم معنا", "أعمال مفتوحة تحتاج من يشاركنا فيها: نشر في قناة، بوت، حساب، أو أي مساهمة نافعة.") +
    (items.length ? `<div style="margin-top:22px">${opportunityRows(items)}</div>`
      : `<div class="empty"><p>لا توجد فرص مساهمة مفتوحة حاليًا.</p><p style="margin-top:14px"><a href="/contact?about=${encodeURIComponent("مساهمة")}" class="btn btn-ghost">عرض مساهمة من عندك</a></p></div>`)) });
}

export function helpPage(items) {
  return layout({ title: "ساعد", path: "/help", body: wrapMain(pageHead("ساعد", "حالات من متابعينا تحتاج مساعدة، راجعها الفريق. المساعدة اختيارية وتتم عبر الجهة المذكورة في كل حالة، وليس عبر هذا الموقع.") +
    (items.length ? `<div style="margin-top:22px">${projectRows(items, { highlight: true })}</div>` : `<div class="empty"><p>لا توجد حالات مفتوحة حاليًا.</p></div>`) +
    `<p class="hint-text" style="margin-top:30px">هل تحتاج مساعدة من المتابعين؟ <a href="/contact?about=${encodeURIComponent("طلب مساعدة")}" style="color:var(--accent)">راسلنا</a> وسيراجع الفريق طلبك.</p>`) });
}

export function morePage(botUrl) {
  const items = [["/about", "عن أثر أواب ومعنى الاسم"], ["/contact", "راسلنا"], ...(botUrl ? [[botUrl, "راسلنا عبر البوت", true]] : []),
    ["/contribute", "ساهم معنا"], ["/help", "ساعد"], ["/websites", "مواقعنا"]];
  return layout({ title: "المزيد", path: "/more", body: wrapMain(`${pageHead("المزيد")}<div class="plist" style="margin-top:22px">${items.map(([h, l, ext]) =>
    ext ? `<a class="prow" href="${esc(h)}" target="_blank" rel="noopener noreferrer"><div class="prow-t">${l}</div>${icon("external", 18)}</a>`
        : `<a class="prow" href="${h}"><div class="prow-t">${l}</div>${icon("arrow", 18)}</a>`).join("")}</div>`) });
}

export function aboutPage() {
  const age = projectAgeYears();
  return layout({ title: "عن أثر أواب ومعنى الاسم", path: "/about", body: wrapMain(`${pageHead("عن أثر أواب", "معنى الاسم، والرسالة.")}<div class="edesc" style="margin-top:26px">
<h2 class="sec-title" style="margin-bottom:8px">لماذا «أثر أواب»؟</h2><p>الأثر ما يبقى بعد صاحبه: عمل أو كلمة أو معرفة تنتقل من شخص لآخر وتستمر في النفع. و«أواب» صفة العبد الكثير الرجوع إلى الله. الاسم يجمع الفكرتين: أثرٌ باقٍ يبدأ بقلبٍ عائد.</p>
<h2 class="sec-title" style="margin:30px 0 8px">الرسالة</h2><p>مشروع دعوي رقمي غير ربحي بدأ عام ${PROJECT_START_YEAR}، ينظّم قنوات وبوتات وجروبات تيليجرام ومجموعات ملصقات دينية ومواقع ومشاريع مستقلة، في تجربة واحدة منظّمة.</p>
<h2 class="sec-title" style="margin:30px 0 8px">الطبيعة غير الربحية</h2><p>لا يهدف أثر أواب إلى الربح. الظهور ضمن «مشاريع مدعومة» مجاني، ويخضع لمراجعة إدارية فقط للتأكد من ملاءمته لرسالة المشروع.</p></div>
<div class="meta-row"><div><b>${PROJECT_START_YEAR}</b><span>بداية المشروع</span></div>${age > 0 ? `<div><b>${age}</b><span>${esc(yearsPhrase(age).replace(/^\d+ /, ""))} من العمل</span></div>` : ""}</div>`) });
}

export function contactPage({ sent, error, about, botUrl }) {
  const msg = String(about ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 120);
  const err = { message_required: "الرسالة مطلوبة.", rate_limited: "وصلت للحد الأقصى من الرسائل. حاول لاحقًا.", failed: "تعذّر الإرسال الآن. حاول لاحقًا." }[error];
  return layout({ title: "تواصل معنا", path: "/contact", body: `<main id="main" class="wrap" style="max-width:640px">${pageHead("تواصل معنا", "نحن هنا للاستماع.")}${
    botUrl ? `<a class="btn btn-primary btn-block" style="margin-top:22px" href="${esc(botUrl)}" target="_blank" rel="noopener noreferrer">${icon("send", 20)}راسلنا عبر البوت (أسرع وسيلة)</a>` : ""}${
    sent ? `<p role="status" class="edesc">تم استلام رسالتك، وسيتواصل معك الفريق بإذن الله.</p>` : `<form action="/api/contact" method="post" style="margin-top:26px">${
      err ? `<p role="alert" style="color:var(--danger);margin-bottom:12px">${err}</p>` : ""}
<div class="field"><label for="name">الاسم (اختياري)</label><input id="name" type="text" name="name" maxlength="100"></div>
<div class="field"><label for="contact">وسيلة التواصل (اختياري)</label><input id="contact" type="text" name="contact" maxlength="200" placeholder="بريد إلكتروني أو رقم"></div>
<div class="field"><label for="message">الرسالة</label><textarea id="message" name="message" required rows="5" maxlength="4000">${msg ? esc(msg) + "\n\n" : ""}</textarea></div>
<input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">
<button type="submit" class="btn btn-primary">إرسال</button></form>`}</main>` });
}

export function notFoundPage() {
  return layout({ title: "الصفحة غير موجودة", path: "/404", noindex: true, body: `<main id="main" class="wrap empty"><p class="display" style="font-size:22px;font-weight:800;color:var(--ink)">الصفحة غير موجودة</p><p style="margin:10px 0 22px">ربما نُقلت أو لم تعد منشورة.</p><a href="/explore" class="btn btn-primary">استكشف المشروع</a></main>` });
}

export function errorPage() {
  return layout({ title: "تعذّر التحميل", path: "/error", noindex: true, body: `<main id="main" class="wrap empty"><p class="display" style="font-size:22px;font-weight:800;color:var(--ink)">تعذّر تحميل المحتوى الآن</p><p style="margin:10px 0 22px">حدث خطأ غير متوقع. حاول مرة أخرى بعد لحظات.</p><a href="/" class="btn btn-primary">العودة للرئيسية</a></main>` });
}

export function sitemapXml(entities) {
  const base = (process.env.SITE_URL || "").replace(/\/$/, "");
  const fixed = ["", "/explore", "/channels", "/bots", "/groups", "/stickers", "/websites", "/about", "/contact", "/contribute", "/help"];
  const urls = [...fixed.map((p) => ({ loc: base + (p || "/"), mod: null })),
    ...entities.map((e) => ({ loc: `${base}/${TYPE_PATH[e.entity_type]}/${encodeURIComponent(e.slug)}`, mod: e.updated_at }))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.mod ? `<lastmod>${esc(new Date(u.mod).toISOString())}</lastmod>` : ""}</url>`).join("\n")}\n</urlset>`;
}

export function robotsTxt() {
  const base = (process.env.SITE_URL || "").replace(/\/$/, "");
  return `User-agent: *\nAllow: /\nDisallow: /tg/\nDisallow: /api/\n${base ? `Sitemap: ${base}/sitemap.xml\n` : ""}`;
}
