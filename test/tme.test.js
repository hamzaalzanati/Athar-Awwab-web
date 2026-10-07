import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyLink, tmeFetchUrl, parseTmePage, suggestCategoryLabel, buildEntityRow, extractUrls } from "../lib/tme.js";

test("links are classified by their shape", () => {
  assert.deepEqual(classifyLink("https://t.me/quran_hz1"), { kind: "channel", username: "quran_hz1" });
  assert.deepEqual(classifyLink("https://t.me/Quran_hz4bot"), { kind: "bot", username: "Quran_hz4bot" });
  assert.deepEqual(classifyLink("https://t.me/Gaza_44_bot"), { kind: "bot", username: "Gaza_44_bot" });
  assert.deepEqual(classifyLink("https://t.me/addstickers/Quran_hz"), { kind: "sticker_pack", username: "Quran_hz" });
  assert.deepEqual(classifyLink("https://t.me/+-1jAJ5HN_Dw2ZWRk"), { kind: "invite", hash: "+-1jAJ5HN_Dw2ZWRk" });
  assert.deepEqual(classifyLink("https://t.me/+_B4e8LxW4QMwNzE0"), { kind: "invite", hash: "+_B4e8LxW4QMwNzE0" });
  assert.equal(classifyLink("https://whatsapp.com/channel/0029Vb6Z5HeBlHpg0XE9xo1i").platform, "WhatsApp");
  assert.equal(classifyLink("https://www.facebook.com/share/1976eK3zzG/").platform, "Facebook");
  assert.equal(classifyLink("https://www.threads.com/@Quran_hz1").platform, "Threads");
  assert.equal(classifyLink("https://x.com/Quran_hz1").platform, "X");
  assert.equal(classifyLink("https://www.pinterest.com/quran_hz1").platform, "Pinterest");
  assert.equal(classifyLink("https://sabha-hz.vercel.app/").kind, "unknown");
  for (const bad of ["javascript:alert(1)", "not a url", "https://t.me/", "https://t.me/a", "https://t.me/x/y/z/w"]) assert.equal(classifyLink(bad).kind, "invalid", bad);
});
test("the server only ever fetches t.me URLs it built itself (no SSRF)", () => {
  assert.equal(tmeFetchUrl({ kind: "channel", username: "quran_hz1" }), "https://t.me/quran_hz1");
  assert.equal(tmeFetchUrl({ kind: "invite", hash: "+abcdefgh12" }), "https://t.me/+abcdefgh12");
  assert.equal(tmeFetchUrl({ kind: "sticker_pack", username: "P" }), "https://t.me/addstickers/P");
  assert.equal(tmeFetchUrl({ kind: "social" }), null);
  assert.equal(tmeFetchUrl(classifyLink("https://t.me.evil.com/abcd")), null);
  assert.equal(classifyLink("https://evil.com/t.me/abcd").kind, "unknown");
});

const channelHtml = `<html><head><meta property="og:title" content="القرآن &amp; الكريم"><meta property="og:image" content="https://cdn4.telesco.pe/file/abc.jpg">
<meta property="og:description" content="تلاوات مختارة من القرآن"></head><body>
<div class="tgme_page_title" dir="auto"><span dir="auto">القرآن &amp; الكريم</span></div>
<div class="tgme_page_extra">12 345 subscribers</div><div class="tgme_page_description" dir="auto">تلاوات مختارة<br>من القرآن</div></body></html>`;
test("channel page: title, description, count and image are extracted and entities decoded", () => {
  const p = parseTmePage(channelHtml);
  assert.equal(p.kind, "channel"); assert.equal(p.title, "القرآن & الكريم"); assert.equal(p.count, 12345);
  assert.equal(p.image, "https://cdn4.telesco.pe/file/abc.jpg"); assert.match(p.description, /تلاوات مختارة/); assert.equal(p.resolved, true);
});
test("group page vs bot/user page vs invalid page", () => {
  const g = parseTmePage('<div class="tgme_page_title"><span>جروب</span></div><div class="tgme_page_extra">1 204 members, 15 online</div>');
  assert.equal(g.kind, "group"); assert.equal(g.count, 1204);
  const b = parseTmePage('<div class="tgme_page_title"><span>Bot</span></div><div class="tgme_page_extra">@my_bot</div>');
  assert.equal(b.kind, "account"); assert.equal(b.count, null);
  const bad = parseTmePage('<meta property="og:title" content="Telegram: Contact @nobody"><div class="tgme_page_extra"></div>');
  assert.equal(bad.resolved, false); assert.equal(bad.title, null);
  assert.equal(parseTmePage("").resolved, false);
});
test("untrusted images are dropped (non-https, Telegram's default logo)", () => {
  assert.equal(parseTmePage('<meta property="og:image" content="http://x.com/a.jpg"><div class="tgme_page_title"><span>x</span></div>').image, null);
  assert.equal(parseTmePage('<meta property="og:image" content="https://telegram.org/img/t_logo.png"><div class="tgme_page_title"><span>x</span></div>').image, null);
});

test("category suggestions follow explicit keyword rules; no match => none; groups/stickers fixed", () => {
  assert.equal(suggestCategoryLabel("channel", "القرآن الكريم الصفحة 5", ""), "قنوات القرآن مقسم صفحات");
  assert.equal(suggestCategoryLabel("channel", "سيرة النبي", ""), "قنوات السيرة النبوية");
  assert.equal(suggestCategoryLabel("channel", "تلاوات", "قرآن بصوت متنوع"), "قنوات محتوى القرآن متنوع");
  assert.equal(suggestCategoryLabel("channel", "اسم غير معبّر", ""), null);
  assert.equal(suggestCategoryLabel("group", "أي شيء", ""), "جروبات");
  assert.equal(suggestCategoryLabel("sticker_pack", "x", ""), "ملصقات دينية");
  assert.equal(suggestCategoryLabel("bot", "بوت القرآن", ""), "قرآن");
});
const CATS = [{ id: "c1", entity_type: "channel", label_ar: "قنوات محتوى القرآن متنوع" }, { id: "g1", entity_type: "group", label_ar: "جروبات" }, { id: "s1", entity_type: "sticker_pack", label_ar: "ملصقات دينية" }];
test("entity rows: type from page, private channels keep the invite link, own relationship, category only when it exists", () => {
  const page = parseTmePage(channelHtml);
  const r = buildEntityRow({ kind: "channel", username: "quran_hz1" }, page, CATS);
  assert.deepEqual([r.entity_type, r.telegram_username, r.subscriber_count, r.category_id, r.relationship], ["channel", "quran_hz1", 12345, "c1", "own"]);
  const grp = buildEntityRow({ kind: "invite", hash: "+abcdefgh12" }, parseTmePage('<div class="tgme_page_title"><span>نقاش</span></div><div class="tgme_page_extra">50 members</div>'), CATS);
  assert.deepEqual([grp.entity_type, grp.invite_url, grp.telegram_username, grp.category_id], ["group", "https://t.me/+abcdefgh12", null, "g1"]);
  assert.equal(buildEntityRow({ kind: "sticker_pack", username: "Quran_hz" }, { title: "ملصقات", description: null }, CATS).category_id, "s1");
  assert.equal(buildEntityRow({ kind: "bot", username: "x_bot" }, { title: "بوت", description: null }, CATS).category_id, null);
  assert.equal(buildEntityRow({ kind: "bot", username: "x_bot" }, null, CATS).name, "x_bot");
  assert.equal(buildEntityRow({ kind: "invite", hash: "+abcdefgh12" }, null, CATS), null);
});
test("pasted text yields clean, unique URLs", () => {
  const t = "https://t.me/a_bc1،https://t.me/a_bc1\nرابط: (https://x.com/q).\nhttps://t.me/+Ab-12345678;";
  assert.deepEqual(extractUrls(t), ["https://t.me/a_bc1", "https://x.com/q", "https://t.me/+Ab-12345678"]);
});

test("imported titles/descriptions lose emoji and invisible marks but keep Arabic text and the salawat sign", () => {
  const p = parseTmePage('<div class="tgme_page_title"><span>\u200Bاسلامي نور 🌿 قلبي\uFE0F</span></div><div class="tgme_page_extra">5 subscribers</div><div class="tgme_page_description">نسير مع سنة نبيه ﷺ. 🌿 \u200B"ذكر"</div>');
  assert.equal(p.title, "اسلامي نور قلبي");
  assert.equal(p.description, 'نسير مع سنة نبيه ﷺ. "ذكر"');
});
