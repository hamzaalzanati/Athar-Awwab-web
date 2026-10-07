// كل صفحات الموقع العامة تُرسَم هنا كـ HTML من الخادم (جيدة لمحركات البحث).
import * as data from "../lib/data.js";
import * as pages from "../lib/pages.js";
import { db } from "../lib/db.js";
import { normalizeAr } from "../lib/normalize.js";

const TYPES = { channel: 1, bot: 1, group: 1, sticker_pack: 1 };
const CACHE = "public, s-maxage=60, stale-while-revalidate=300";

function botContactUrl() {
  const u = (process.env.BOT_USERNAME || "").replace(/^@/, "").trim();
  return /^[A-Za-z0-9_]{5,32}$/.test(u) ? `https://t.me/${u}` : null;
}

function safeDecode(v) { try { return decodeURIComponent(v); } catch { return v; } }

function send(res, status, body, { type = "text/html; charset=utf-8", cache = CACHE } = {}) {
  res.status(status).setHeader("Content-Type", type).setHeader("Cache-Control", cache).send(body);
}

export default async function handler(req, res) {
  const q = req.query ?? {};
  const one = (v) => (Array.isArray(v) ? v[0] : v);
  const route = one(q.r) ?? "home";
  try {
    switch (route) {
      case "home": return send(res, 200, pages.homePage(await data.getHome()));
      case "explore": {
        const [h, cats] = await Promise.all([data.getHome(), data.getCategoryOverview()]);
        return send(res, 200, pages.explorePage(h, cats));
      }
      case "list": {
        const t = one(q.t);
        if (!TYPES[t]) return send(res, 404, pages.notFoundPage(), { cache: "no-store" });
        const [items, cats] = await Promise.all([data.listEntities(t, 200), data.getCategories(t)]);
        return send(res, 200, pages.listPage(t, items, cats));
      }
      case "entity": {
        const t = one(q.t), slug = decodeURIComponent(String(one(q.slug) ?? ""));
        if (!TYPES[t]) return send(res, 404, pages.notFoundPage(), { cache: "no-store" });
        const result = await data.getEntity(t, slug);
        if (!result) return send(res, 404, pages.notFoundPage(), { cache: "no-store" });
        return send(res, 200, pages.entityPage(result, t));
      }
      case "search": {
        const term = String(one(q.q) ?? "").trim().slice(0, 100);
        const results = term ? await data.search(term) : [];
        if (term && results.length === 0) db().rpc("bump_search_miss", { p_term: normalizeAr(term) }).then(() => {}, () => {});
        return send(res, 200, pages.searchPage(term, results), { cache: "no-store" });
      }
      case "websites": return send(res, 200, pages.websitesPage(await data.getProjects("website")));
      case "contribute": return send(res, 200, pages.contributePage(await data.getOpportunities()));
      case "help": return send(res, 200, pages.helpPage(await data.getProjects("help")));
      case "more": return send(res, 200, pages.morePage(botContactUrl()));
      case "about": return send(res, 200, pages.aboutPage());
      case "contact": return send(res, 200, pages.contactPage({ sent: one(q.sent) === "1", error: one(q.error), about: one(q.about), botUrl: botContactUrl() }), { cache: "no-store" });
      case "sitemap": return send(res, 200, pages.sitemapXml(await data.sitemapEntities()), { type: "application/xml; charset=utf-8", cache: "public, s-maxage=3600" });
      case "robots": return send(res, 200, pages.robotsTxt(), { type: "text/plain; charset=utf-8", cache: "public, s-maxage=86400" });
      default: return send(res, 404, pages.notFoundPage(), { cache: "no-store" });
    }
  } catch (err) {
    console.error("page error:", err?.message); // لا نعرض الخطأ للزائر
    return send(res, 500, pages.errorPage(), { cache: "no-store" });
  }
}
