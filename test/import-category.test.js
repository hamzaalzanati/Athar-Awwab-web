import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEntities, parseProjects, parseSocial, MAX_LINES } from "../lib/import.js";
import { groupByCategory, telegramJoinUrl } from "../lib/render.js";
import * as pages from "../lib/pages.js";

const CATS = [
  { id: "c1", entity_type: "channel", label_ar: "قنوات محتوى القرآن متنوع" }, { id: "c2", entity_type: "channel", label_ar: "قنوات السيرة النبوية" },
  { id: "g1", entity_type: "group", label_ar: "جروبات" }, { id: "b1", entity_type: "bot", label_ar: "قرآن" }, { id: "b2", entity_type: "bot", label_ar: "قرآن مقسم صفحات" },
];

test("entities import: types, relationship, category by normalized name, @ stripped", () => {
  const { rows, problems } = parseEntities("# تعليق\nقناة | قرآن بصوت متنوع | @quran_demo | قنوات محتوى القرآن متنوع | من مشروعنا | وصف\nبوت | بوت | @my_bot | قرآن | مدعوم\nجروب | نقاش | | جروبات", CATS);
  assert.deepEqual(problems, []);
  assert.deepEqual(rows.map((r) => [r.entity_type, r.telegram_username, r.category_id, r.relationship]), [["channel", "quran_demo", "c1", "own"], ["bot", "my_bot", "b1", "supported"], ["group", null, "g1", null]]);
  assert.equal(rows[0].short_description, "وصف");
});
test("a category must belong to the entity type (groups are not channel categories) and be unambiguous", () => {
  const { problems } = parseEntities("قناة | أ | @abc | جروبات", CATS);
  assert.match(problems[0].reason, /تصنيف/);
  assert.match(parseEntities("بوت | أ | @abcd_bot | قرآن", CATS).rows.length ? "" : "x", /^$/); // exact match wins over "قرآن مقسم صفحات"
  assert.equal(parseEntities("بوت | أ | @abcd_bot | قرآن", CATS).rows[0].category_id, "b1");
});
test("import rejects bad rows with a reason and still imports the good ones; duplicates in the list are flagged", () => {
  const { rows, problems } = parseEntities("شيء | أ | @abc\nقناة | | @abc\nقناة | ب | @bad name\nقناة | جيد | @good_one\nقناة | جيد مكرر | @good_one\nملصقات | حزمة | \nقناة | ج | @abc | | علاقة خاطئة", CATS);
  assert.deepEqual(rows.map((r) => r.name), ["جيد"]);
  assert.equal(problems.length, 6);
  assert.deepEqual(problems.map((p) => p.line), [1, 2, 3, 5, 6, 7]);
});
test("sticker packs need a pack name and accept an addstickers link", () => {
  assert.equal(parseEntities("ملصقات | حزمة | https://t.me/addstickers/MyPack_1", CATS).rows[0].telegram_username, "MyPack_1");
});
test("line limit", () => {
  assert.throws(() => parseEntities(Array.from({ length: MAX_LINES + 1 }, (_, i) => `قناة | ${i} | @name_${i}`).join("\n"), CATS), /too_many_lines/);
});
test("projects and social imports validate links", () => {
  const p = parseProjects("موقع | موقع مسبحتي | https://example.com | مسبحة\nساعد | حالة | https://x.org | وصف | 2026-12-31\nموقع | س | javascript:alert(1)\nغريب | اسم | https://a.com");
  assert.deepEqual(p.rows.map((r) => r.kind), ["website", "help"]);
  assert.equal(p.rows[1].expires_at, "2026-12-31T00:00:00.000Z");
  assert.deepEqual(p.problems.map((x) => x.line), [3, 4]);
  const s = parseSocial("Instagram | أثر | https://instagram.com/x\nTikTok | بلا رابط |\nX | س | javascript:1");
  assert.equal(s.rows.length, 1); assert.equal(s.problems.length, 2);
});

test("category grouping follows category order, keeps uncategorised last, drops empty groups", () => {
  const items = [{ id: 1, category_id: "c2" }, { id: 2, category_id: "c1" }, { id: 3, category_id: null }, { id: 4, category_id: "c2" }];
  const g = groupByCategory(items, [CATS[0], CATS[1], { id: "c9", label_ar: "فارغ" }]);
  assert.deepEqual(g.map((x) => x.id), ["c1", "c2", "other"]);
  assert.deepEqual(g[1].items.map((i) => i.id), [1, 4]);
});
test("sticker packs link through addstickers, others through the username", () => {
  assert.equal(telegramJoinUrl("sticker_pack", "MyPack"), "https://t.me/addstickers/MyPack");
  assert.equal(telegramJoinUrl("channel", "@abc"), "https://t.me/abc");
  assert.equal(telegramJoinUrl("channel", "a b"), null);
});
test("list page: category chips + sections only when there is data; escapes names", () => {
  const item = (id, cat, name) => ({ id, slug: `s${id}`, entity_type: "channel", name, short_description: null, image_url: null, subscriber_count: 500, category_id: cat });
  const html = pages.listPage("channel", [item(1, "c1", "<b>x</b>"), item(2, "c2", "ب")], CATS);
  assert.match(html, /catnav/); assert.match(html, /id="cat-c1"/); assert.match(html, /id="cat-c2"/);
  assert.ok(!html.includes("<b>x</b>"));
  assert.match(pages.listPage("channel", [], CATS), /لا توجد عناصر/);
});
test("explore lists only categories that have published entities", () => {
  const h = pages.explorePage({ counts: { channels: 1, bots: 0, groups: 0, stickers: 0 }, websites: [], contributed: [], supported: [], social: [] },
    [{ id: "c1", entity_type: "channel", label_ar: "قنوات السيرة النبوية", count: 3 }]);
  assert.match(h, /التصنيفات/); assert.match(h, /channels#cat-c1/);
  assert.doesNotMatch(pages.explorePage({ counts: { channels: 0, bots: 0, groups: 0, stickers: 0 }, websites: [], contributed: [], supported: [], social: [] }, []), /التصنيفات/);
});
