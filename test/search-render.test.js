import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAr, searchTokens, expandToken, rankResults, slugify } from "../lib/normalize.js";
import { esc, safeUrl, safeImg, card, entityVisual, projectRows, opportunityRows, telegramPreview, layout } from "../lib/render.js";
import * as pages from "../lib/pages.js";

test("normalization unifies alef/ya/ta-marbuta and strips diacritics", () => {
  assert.equal(normalizeAr("القُرْآنُ الكريمة"), "القران الكريمه");
  assert.equal(normalizeAr("إِسلام أخلاق"), "اسلام اخلاق");
  assert.equal(normalizeAr("هدى"), "هدي");
});
test("search tokens contain no filter-injection characters", () => {
  const t = searchTokens('قرآن,name.eq.1) or (id.gt.0 "x" %_*');
  for (const x of t) assert.match(x, /^[\p{L}\p{N}]+$/u);
  assert.ok(t.length <= 5);
  assert.deepEqual(searchTokens("   "), []);
  assert.deepEqual(searchTokens("ا"), []);
});
test("synonyms expand and ranking prefers exact then prefix then description", () => {
  assert.ok(expandToken("قران").includes("مصحف"));
  assert.deepEqual(expandToken("غيرموجود"), ["غيرموجود"]);
  const rows = [{ name: "قناة أخرى", short_description: "تلاوات القرآن", subscriber_count: 9000 }, { name: "القرآن", short_description: "", subscriber_count: 10 }, { name: "القرآن الكريم", short_description: "", subscriber_count: 500 }];
  assert.deepEqual(rankResults(rows, "القرآن").map((r) => r.name), ["القرآن", "القرآن الكريم", "قناة أخرى"]);
});
test("slugify keeps Arabic and always appends the suffix", () => {
  assert.equal(slugify("ناشر السيرة!", "ab12"), "ناشر-السيرة-ab12");
  assert.equal(slugify("!!!", "x"), "item-x");
});

const EVIL = `<script>alert(1)</script>"'&`;
test("escaping neutralises markup everywhere user/admin text is rendered", () => {
  assert.equal(esc(EVIL), "&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;");
  const html = [
    card({ entity_type: "channel", slug: "a", name: EVIL, short_description: EVIL, image_url: null, subscriber_count: 500 }),
    projectRows([{ id: "1", name: EVIL, description: EVIL, url: "javascript:alert(1)", image_url: "javascript:alert(1)" }], { highlight: true }),
    opportunityRows([{ id: "1", kind: "other", title: EVIL, target_label: EVIL, description: EVIL, apply_url: "javascript:alert(1)", expires_at: null }]),
    telegramPreview({ name: EVIL, image_url: null }, [{ id: "m", message_type: "text", text_content: EVIL, caption: null, buttons: [[{ text: EVIL }]], original_link: "javascript:x", original_ts: null }]),
    pages.searchPage(EVIL, []), pages.contactPage({ about: EVIL }),
  ].join("");
  assert.ok(!html.includes("<script>"), "raw <script> leaked");
  assert.ok(!/href="javascript:/i.test(html) && !/src="javascript:/i.test(html));
  assert.ok(!html.includes('="' + EVIL));
});
test("url helpers allow only http(s) / safe image refs", () => {
  assert.equal(safeUrl("https://a.com/x"), "https://a.com/x");
  for (const v of ["javascript:1", "data:x", "", null]) assert.equal(safeUrl(v), null);
  assert.equal(safeImg("/images/a.jpg"), "/images/a.jpg");
  for (const v of ["//x.com/a", "/../a", 'https://x.com/a"b', "http://x.com/a.jpg", "javascript:1"]) assert.equal(safeImg(v), null);
});
test("entity visual falls back to generated artwork (no logo circle), deterministic per name", () => {
  const a = entityVisual("قناة", null), b = entityVisual("قناة", null);
  assert.equal(a, b); assert.match(a, /<svg/);
  assert.match(entityVisual("x", "/images/a.jpg"), /<img src="\/images\/a.jpg"/);
});
test("hero picture precedence: admin > env > shipped file; unsafe values ignored", () => {
  assert.equal(pages.resolveHero("https://a.com/x.jpg", "/images/o.jpg"), "https://a.com/x.jpg");
  assert.equal(pages.resolveHero(null, "/images/o.jpg"), "/images/o.jpg");
  assert.equal(pages.resolveHero(null, undefined), "/images/hero.jpg");
  assert.equal(pages.resolveHero("javascript:1", "//evil.com/a.jpg"), "/images/hero.jpg");
});

const empty = { counts: { channels: 0, bots: 0, groups: 0, stickers: 0, websites: 0 }, settings: { heroImageUrl: null, botUsersTotal: 0 },
  fresh: [], followed: [], websites: [], contributed: [], supported: [], help: [], opportunities: [], social: [] };
test("home page renders no empty sections and no zero statistics", () => {
  const html = pages.homePage(empty);
  assert.ok(!html.includes('class="stats"'), "stats band rendered with no data");
  for (const t of ["جديدنا", "الأكثر متابعة", "مواقعنا", "ساهم", "ساعد", "تابعنا", "وصول سريع"]) assert.ok(!html.includes(`<h2 class="sec-title">${t}</h2>`), `empty section: ${t}`);
  assert.match(html, /أثر أواب/); assert.match(html, /\/images\/hero\.jpg/);
});
test("home page shows sections only when they have real data, with Western digits", () => {
  const html = pages.homePage({ ...empty, counts: { ...empty.counts, channels: 12 }, help: [{ id: "h", name: "حالة", description: null, url: "https://x.com", image_url: null, expires_at: "2026-12-31T00:00:00Z" }],
    opportunities: [{ id: "o", kind: "publishing", title: "ناشر لقناة", target_label: null, description: null, apply_url: null, expires_at: null }] });
  assert.match(html, /<b>12<\/b>/); assert.match(html, /<h2 class="sec-title">ساعد<\/h2>/); assert.match(html, /<h2 class="sec-title">ساهم<\/h2>/);
  assert.doesNotMatch(html, /[\u0660-\u0669]/);
});
test("layout: skip link, RTL, canonical only when SITE_URL is set, noindex honoured", () => {
  const h = layout({ title: "ت", path: "/x", body: "<main></main>", noindex: true });
  assert.match(h, /dir="rtl"/); assert.match(h, /skip-link/); assert.match(h, /noindex/);
  assert.doesNotMatch(h, /\p{Emoji_Presentation}/u);
});
test("sitemap lists only what it is given and escapes", () => {
  const x = pages.sitemapXml([{ entity_type: "channel", slug: "a&b", updated_at: "2026-01-01T00:00:00Z" }]);
  assert.match(x, /channels\/a%26b</); assert.doesNotMatch(x, /a&b/); assert.match(x, /<urlset/);
  assert.match(pages.robotsTxt(), /Disallow: \/tg\//);
});
