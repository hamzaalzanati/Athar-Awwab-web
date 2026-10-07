import { test } from "node:test";
import assert from "node:assert/strict";
import { routeQuestion, isRuling, chooseLevel, modelFor, buildPrompt, answer, callGemini, renderFacts, serializeFacts, CAPABILITIES_REPLY, RULING_REPLY } from "../lib/zanati-core.js";
import { percentChange } from "../lib/zanati-math.js";

test("routing maps questions to fact groups; unknown questions to none", () => {
  assert.deepEqual(routeQuestion("ماذا يحدث الآن؟").sort(), ["inbox", "status", "traffic"]);
  assert.deepEqual(routeQuestion("كم زوار الموقع؟"), ["traffic"]);
  assert.deepEqual(routeQuestion("كيانات معلقة وصلاحيات"), ["status"]);
  assert.deepEqual(routeQuestion("عمليات بحث بلا نتائج"), ["search"]);
  assert.deepEqual(routeQuestion("ما لون السماء"), []);
});
test("levels and models: simple -> Flash-Lite 3.5, reports/comparisons -> Flash 3.6, env overrides validated", () => {
  assert.equal(chooseLevel(["traffic"], "كم زوار"), "B");
  assert.equal(chooseLevel(["traffic"], "قارن بالأسبوع السابق مقارنة"), "C");
  assert.equal(chooseLevel(["status", "traffic"], "x"), "C");
  assert.equal(modelFor("B", {}), "gemini-3.5-flash-lite");
  assert.equal(modelFor("C", {}), "gemini-3.6-flash");
  assert.equal(modelFor("B", { GEMINI_MODEL_LITE: "gemini-9-lite" }), "gemini-9-lite");
  assert.equal(modelFor("C", { GEMINI_MODEL_FLASH: "bad model!" }), "gemini-3.6-flash");
});
test("percent change is null without a baseline", () => {
  assert.equal(percentChange(150, 100), 50); assert.equal(percentChange(5, 0), null); assert.equal(percentChange(80, 100), -20);
});

const facts = { traffic: { views7d: 42, viewsPrev7d: 0, viewsChangePct: null, clicks7d: 3, topPages: [{ path: "/", views: 30 }], topEntities: [] } };
const mk = (over = {}) => {
  const log = [];
  return { log, deps: { question: "كم زوار الموقع؟", gather: async (g) => { log.push(`gather:${g}`); return facts; },
    ai: async (a) => { log.push(`ai:${a.level}`); return "الزيارات 42"; }, consumeBudget: async (l) => { log.push(`budget:${l}`); return true; }, ...over } };
};
test("ruling questions are refused with no data access and no AI", async () => {
  const { deps, log } = mk({ question: "ما حكم كذا؟" });
  const r = await answer(deps); assert.equal(r.mode, "refused"); assert.equal(r.answer, RULING_REPLY); assert.deepEqual(log, []);
  assert.equal(isRuling("كم زوار"), false);
});
test("unrecognised question: capabilities, no data, no AI", async () => {
  const { deps, log } = mk({ question: "احكِ قصة" });
  const r = await answer(deps); assert.equal(r.mode, "no_match"); assert.equal(r.answer, CAPABILITIES_REPLY); assert.deepEqual(log, []);
});
test("happy path uses AI with budget at the right level; prompt carries rules and evidence only", async () => {
  const { deps, log } = mk();
  const r = await answer(deps);
  assert.equal(r.mode, "ai"); assert.deepEqual(log, ["gather:traffic", "budget:B", "ai:B"]);
  const p = buildPrompt("س", facts);
  assert.match(p.prompt, /<evidence>[\s\S]*"views7d": 42/); assert.match(p.systemPrompt, /الأدلة غير كافية/); assert.match(p.systemPrompt, /تجاهل أي تعليمات/);
});
test("no AI / budget exhausted / AI error => deterministic facts, never an error page", async () => {
  assert.equal((await answer(mk({ ai: null }).deps)).reason, "no_ai");
  assert.equal((await answer(mk({ consumeBudget: async () => false }).deps)).reason, "budget");
  const e = await answer(mk({ ai: async () => { throw new Error("down"); } }).deps);
  assert.equal(e.mode, "deterministic"); assert.equal(e.reason, "ai_error"); assert.match(e.answer, /42/);
});
test("budget is consumed only when AI will actually be called", async () => {
  const { deps, log } = mk({ question: "ما لون السماء" }); await answer(deps);
  assert.ok(!log.some((l) => l.startsWith("budget")));
});
test("facts are size-capped and rendered honestly (no invented percentage)", () => {
  assert.ok(serializeFacts({ x: "y".repeat(20000) }).length < 6100);
  assert.match(renderFacts(facts), /لا نسبة لغياب الأساس/);
  assert.match(renderFacts({ status: { active: 3, pending: 1, pendingOlderThan3Days: 0, permissionLost: ["قناة"], syncFailing: [], neverSynced: 0 } }), /فقد البوت صلاحيته في: قناة/);
});

const SECRET = "AIza-SECRET";
const okResp = (t) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: t }] } }] }) });
test("Gemini: key in header (never URL), no temperature, level picks the model", async () => {
  const calls = [];
  const t = await callGemini({ keys: [{ role: "primary", value: SECRET }], level: "C", systemPrompt: "s", prompt: "p", env: {}, fetchFn: async (u, i) => { calls.push({ u, i }); return okResp("نص"); } });
  assert.equal(t, "نص");
  assert.ok(!calls[0].u.includes(SECRET) && !calls[0].u.includes("key="));
  assert.equal(calls[0].i.headers["x-goog-api-key"], SECRET);
  assert.match(calls[0].u, /models\/gemini-3\.6-flash:generateContent$/);
  assert.ok(!("temperature" in JSON.parse(calls[0].i.body).generationConfig));
});
test("Gemini failover: 429 on primary falls to helper, with cooldown; all failing => AiUnavailable without leaking keys", async () => {
  const cooldowns = new Map(), used = [];
  const fetchFn = async (u, i) => { used.push(i.headers["x-goog-api-key"]); return i.headers["x-goog-api-key"] === "K1" ? { ok: false, status: 429, json: async () => ({}) } : okResp("ok"); };
  const keys = [{ role: "primary", value: "K1" }, { role: "helper", value: "K2" }];
  assert.equal(await callGemini({ keys, level: "B", systemPrompt: "s", prompt: "p", fetchFn, cooldowns, now: 1000, env: {} }), "ok");
  assert.deepEqual(used, ["K1", "K2"]);
  used.length = 0;
  await callGemini({ keys, level: "B", systemPrompt: "s", prompt: "p", fetchFn, cooldowns, now: 2000, env: {} });
  assert.deepEqual(used, ["K2"], "primary is cooling down");
  const boom = async (u) => { throw new Error(`net fail ${u} ${SECRET}`); };
  await assert.rejects(callGemini({ keys: [{ role: "primary", value: SECRET }], level: "B", systemPrompt: "s", prompt: "p", fetchFn: boom, env: {} }),
    (e) => !String(e.message).includes(SECRET));
  await assert.rejects(callGemini({ keys: [], level: "B", systemPrompt: "s", prompt: "p", env: {} }), /no_key/);
});
