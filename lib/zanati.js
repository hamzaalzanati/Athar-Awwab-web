import { db, must } from "./db.js";
import { answer, callGemini } from "./zanati-core.js";
import { percentChange } from "./zanati-math.js";

const DAY = 86400000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const cooldowns = new Map(); // يعيش ما بقيت نسخة الخادم نشطة

function keys() {
  return [["primary", process.env.GEMINI_API_KEY_PRIMARY], ["helper", process.env.GEMINI_API_KEY_HELPER], ["emergency", process.env.GEMINI_API_KEY_EMERGENCY]]
    .map(([role, value]) => ({ role, value: value?.trim() })).filter((k) => k.value);
}

/** حقائق حقيقية من القاعدة فقط، حسب المجموعات المطلوبة. */
export async function gatherFacts(groups, now = Date.now()) {
  const f = {};
  const d = db();
  if (groups.includes("status")) {
    const ents = must(await d.from("entities").select("name,status,permission_state,sync_failures,last_synced_at,telegram_chat_id,discovered_at").limit(2000));
    const pending = ents.filter((e) => e.status === "pending");
    const watched = ents.filter((e) => e.status === "active" && e.telegram_chat_id);
    f.status = {
      active: ents.filter((e) => e.status === "active").length,
      pending: pending.length,
      pendingOlderThan3Days: pending.filter((e) => now - Date.parse(e.discovered_at) > 3 * DAY).length,
      permissionLost: watched.filter((e) => ["removed", "restricted"].includes(e.permission_state)).map((e) => e.name).slice(0, 10),
      syncFailing: watched.filter((e) => e.sync_failures >= 3).map((e) => e.name).slice(0, 10),
      neverSynced: watched.filter((e) => !e.last_synced_at).length,
    };
  }
  if (groups.includes("traffic")) {
    const [cur, prev, clicks, ents] = await Promise.all([
      d.from("page_views").select("path,views").gte("day", iso(now - 6 * DAY)).then(must),
      d.from("page_views").select("views").gte("day", iso(now - 13 * DAY)).lt("day", iso(now - 6 * DAY)).then(must),
      d.from("entity_clicks").select("entity_id,clicks").gte("day", iso(now - 6 * DAY)).then(must),
      d.from("entities").select("id,name").limit(2000).then(must),
    ]);
    const byPath = new Map(); for (const r of cur) byPath.set(r.path, (byPath.get(r.path) ?? 0) + r.views);
    const byEnt = new Map(); for (const r of clicks) byEnt.set(r.entity_id, (byEnt.get(r.entity_id) ?? 0) + r.clicks);
    const names = new Map(ents.map((e) => [e.id, e.name]));
    const views7d = cur.reduce((s, r) => s + r.views, 0), viewsPrev7d = prev.reduce((s, r) => s + r.views, 0);
    f.traffic = {
      views7d, viewsPrev7d, viewsChangePct: percentChange(views7d, viewsPrev7d), clicks7d: clicks.reduce((s, r) => s + r.clicks, 0),
      topPages: [...byPath].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([path, views]) => ({ path, views })),
      topEntities: [...byEnt].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([id, c]) => ({ name: names.get(id) ?? "—", clicks: c })),
    };
  }
  if (groups.includes("search")) {
    const rows = must(await d.from("search_misses").select("term,hits").gte("day", iso(now - 6 * DAY)).limit(500));
    const m = new Map(); for (const r of rows) m.set(r.term, (m.get(r.term) ?? 0) + r.hits);
    f.search = { misses: [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([term, hits]) => ({ term, hits })) };
  }
  if (groups.includes("inbox")) {
    const { count } = await d.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false);
    f.inbox = { unread: count ?? 0 };
  }
  return f;
}

const BUDGET = { B: 150, C: 40 }; // استدعاءات يوميًا لكل مستوى

export function askZanati(question) {
  const k = keys();
  return answer({
    question,
    gather: (groups) => gatherFacts(groups),
    ai: k.length ? (args) => callGemini({ keys: k, cooldowns, ...args }) : null,
    consumeBudget: async (level) => {
      const { data, error } = await db().rpc("consume_ai_budget", { p_level: level, p_max: BUDGET[level] });
      return !error && data === true;
    },
  });
}
