// نقطة واحدة لكل عمليات لوحة التحكم. التحقق من الهوية والصلاحية يتم هنا على الخادم دائمًا.
import { db, must } from "../lib/db.js";
import { verifyInitData, roleAllows } from "../lib/auth.js";
import { ValidationError, httpUrl, imageRef, text, longText, isoDate, oneOf, isUuid } from "../lib/validate.js";
import { slugify } from "../lib/normalize.js";
import { askZanati } from "../lib/zanati.js";
import { parseEntities, parseProjects, parseSocial, MAX_LINES } from "../lib/import.js";
import { classifyLink, tmeFetchUrl, parseTmePage, buildEntityRow } from "../lib/tme.js";

const TYPES = ["channel", "bot", "group", "sticker_pack"];
const STATUSES = ["pending", "active", "hidden", "archived", "rejected"];
const RELS = ["own", "contribution", "supported"];
const OPP_KINDS = ["publishing", "bot", "account", "development", "other"];
const PROJ_KINDS = ["website", "contributed", "supported", "help"];
const ENTITY_LIST = "invite_url,id,entity_type,name,slug,status,relationship,category_id,telegram_username,telegram_chat_id,subscriber_count,is_featured,is_new,permission_state,last_synced_at,sync_failures,image_url,short_description,long_description,bot_functions,subscriber_count_hidden,name_locked,desc_locked,discovered_at";

const uuid = (v, code = "invalid_id") => { if (!isUuid(v)) throw new ValidationError(code); return v; };
const bool = (v) => v === true;
const username = (v) => {
  const s = String(v ?? "").trim().replace(/^@/, "");
  if (!s) return null;
  if (!/^[A-Za-z0-9_]{3,64}$/.test(s)) throw new ValidationError("invalid_username");
  return s;
};
const inviteUrl = (v) => {
  const s = String(v ?? "").trim();
  if (!s) return null;
  if (!/^https:\/\/t\.me\/\+[A-Za-z0-9_-]{8,40}$/.test(s)) throw new ValidationError("invalid_url");
  return s;
};
const rand = () => Math.random().toString(36).slice(2, 6);
const audit = (admin, action, detail = {}) =>
  db().from("audit_log").insert({ admin_id: admin.telegram_user_id, action, detail }).then(() => {}, () => {});

const actions = {
  async overview() {
    const d = db();
    const head = (q) => q.then(({ count }) => count ?? 0);
    const [pending, active, unread, alerts, hb] = await Promise.all([
      head(d.from("entities").select("id", { count: "exact", head: true }).eq("status", "pending")),
      head(d.from("entities").select("id", { count: "exact", head: true }).eq("status", "active")),
      head(d.from("contact_messages").select("id", { count: "exact", head: true }).eq("is_read", false)),
      d.from("alerts").select("key,severity,title,detail,created_at").eq("is_resolved", false).order("created_at", { ascending: false }).limit(10).then(must),
      d.from("site_settings").select("value").eq("key", "bot_heartbeat").limit(1).then(must),
    ]);
    const at = hb[0]?.value?.at ? Date.parse(hb[0].value.at) : null;
    const bot = at === null ? "unknown" : Date.now() - at < 10 * 60_000 ? "healthy" : "stale";
    return { pending, active, unreadMessages: unread, alerts, health: { bot, database: "healthy" } };
  },

  async "pending.list"() {
    return { items: must(await db().from("entities").select(ENTITY_LIST).eq("status", "pending").order("discovered_at", { ascending: false }).limit(50)) };
  },

  async "entity.approve"(b, admin) {
    const id = uuid(b.id);
    const patch = {
      status: "active", approved_at: new Date().toISOString(), is_new: true,
      relationship: oneOf(b.relationship, RELS, "relationship_required"),
      category_id: b.category_id ? uuid(b.category_id, "invalid_category") : null,
    };
    if (b.name) { patch.name = text(b.name, { min: 1, max: 120, code: "invalid_name" }); patch.name_locked = true; }
    if (b.short_description) { patch.short_description = text(b.short_description, { max: 300 }); patch.desc_locked = true; }
    if (b.image_url) patch.image_url = imageRef(b.image_url);
    if (Array.isArray(b.bot_functions)) patch.bot_functions = b.bot_functions.filter((f) => ["content", "publishing"].includes(f));
    must(await db().from("entities").update(patch).eq("id", id).eq("status", "pending").select("id").single());
    await audit(admin, "entity.approve", { id, relationship: patch.relationship });
    return { ok: true };
  },

  async "entity.reject"(b, admin) {
    const id = uuid(b.id);
    must(await db().from("entities").update({ status: "rejected" }).eq("id", id).eq("status", "pending").select("id").single());
    await audit(admin, "entity.reject", { id });
    return { ok: true };
  },

  async "entities.list"(b) {
    let q = db().from("entities").select(ENTITY_LIST).order("updated_at", { ascending: false }).limit(60);
    if (b.status) q = q.eq("status", oneOf(b.status, STATUSES));
    if (b.type) q = q.eq("entity_type", oneOf(b.type, TYPES));
    const term = String(b.q ?? "").replace(/[^\p{L}\p{N}\s]/gu, " ").trim().slice(0, 40);
    if (term) q = q.ilike("search_text", `%${term.toLowerCase()}%`);
    return { items: must(await q) };
  },

  async "entity.update"(b, admin) {
    const id = uuid(b.id);
    const cur = must(await db().from("entities").select("name,short_description").eq("id", id).single());
    const p = {};
    if ("name" in b) { p.name = text(b.name, { min: 1, max: 120, code: "invalid_name" }); if (p.name !== cur.name) p.name_locked = true; }
    if ("short_description" in b) { p.short_description = text(b.short_description, { max: 300 }); if (p.short_description !== cur.short_description) p.desc_locked = true; }
    if ("long_description" in b) p.long_description = longText(b.long_description);
    if ("image_url" in b) p.image_url = imageRef(b.image_url);
    if ("category_id" in b) p.category_id = b.category_id ? uuid(b.category_id, "invalid_category") : null;
    if ("relationship" in b) p.relationship = b.relationship ? oneOf(b.relationship, RELS) : null;
    if ("status" in b) p.status = oneOf(b.status, STATUSES);
    if ("telegram_username" in b) p.telegram_username = username(b.telegram_username);
    if ("invite_url" in b) p.invite_url = inviteUrl(b.invite_url);
    if ("is_featured" in b) p.is_featured = bool(b.is_featured);
    if ("is_new" in b) p.is_new = bool(b.is_new);
    if ("subscriber_count_hidden" in b) p.subscriber_count_hidden = bool(b.subscriber_count_hidden);
    if ("bot_functions" in b && Array.isArray(b.bot_functions)) p.bot_functions = b.bot_functions.filter((f) => ["content", "publishing"].includes(f));
    if ("subscriber_count" in b) {
      const n = b.subscriber_count === null || b.subscriber_count === "" ? null : Number(b.subscriber_count);
      if (n !== null && (!Number.isInteger(n) || n < 0 || n > 1e9)) throw new ValidationError("invalid_number");
      p.subscriber_count = n;
    }
    if (!Object.keys(p).length) throw new ValidationError("nothing_to_update");
    must(await db().from("entities").update(p).eq("id", id).select("id").single());
    await audit(admin, "entity.update", { id, fields: Object.keys(p) });
    return { ok: true };
  },

  // إضافة يدوية لكيان لا يديره البوت (بوت، قناة مدعومة، ملصقات...). لا تكرار: اسم المستخدم فريد عمليًا.
  async "entity.create"(b, admin) {
    const entity_type = oneOf(b.entity_type, TYPES, "invalid_type");
    const name = text(b.name, { min: 1, max: 120, code: "invalid_name" });
    const uname = username(b.telegram_username);
    if (uname) {
      const dup = must(await db().from("entities").select("id").ilike("telegram_username", uname).eq("entity_type", entity_type).limit(1));
      if (dup.length) throw new ValidationError("duplicate_entity");
    }
    const row = {
      entity_type, name, slug: slugify(name, rand()), telegram_username: uname,
      short_description: text(b.short_description, { max: 300 }), image_url: imageRef(b.image_url),
      relationship: b.relationship ? oneOf(b.relationship, RELS) : null,
      category_id: b.category_id ? uuid(b.category_id, "invalid_category") : null,
      bot_functions: Array.isArray(b.bot_functions) ? b.bot_functions.filter((f) => ["content", "publishing"].includes(f)) : [],
      status: "active", approved_at: new Date().toISOString(), is_new: true, name_locked: true, desc_locked: true,
    };
    const created = must(await db().from("entities").insert(row).select("id").single());
    await audit(admin, "entity.create", { id: created.id, entity_type });
    return { ok: true, id: created.id };
  },

  async "categories.list"(b) {
    let q = db().from("categories").select("id,entity_type,label_ar,sort_order,is_active").order("entity_type").order("sort_order");
    if (b.type) q = q.eq("entity_type", oneOf(b.type, TYPES));
    return { items: must(await q) };
  },
  async "category.upsert"(b, admin) {
    const row = { entity_type: oneOf(b.entity_type, TYPES, "invalid_type"), label_ar: text(b.label_ar, { min: 2, max: 80, code: "invalid_name" }),
      sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0, is_active: b.is_active !== false };
    if (b.id) must(await db().from("categories").update(row).eq("id", uuid(b.id)).select("id").single());
    else must(await db().from("categories").insert(row).select("id").single());
    await audit(admin, "category.upsert", { label: row.label_ar });
    return { ok: true };
  },

  async "projects.list"(b) {
    let q = db().from("projects").select("id,kind,name,description,url,image_url,is_active,expires_at,sort_order").order("kind").order("sort_order").limit(200);
    if (b.kind) q = q.eq("kind", oneOf(b.kind, PROJ_KINDS));
    return { items: must(await q) };
  },
  async "project.upsert"(b, admin) {
    const kind = oneOf(b.kind, PROJ_KINDS, "invalid_kind");
    const row = { kind, name: text(b.name, { min: 2, max: 120, code: "invalid_name" }), description: text(b.description, { max: 500 }),
      url: httpUrl(b.url), image_url: imageRef(b.image_url), expires_at: kind === "help" ? isoDate(b.expires_at) : null,
      sort_order: Number.isInteger(Number(b.sort_order)) ? Number(b.sort_order) : 0 };
    if (b.id) must(await db().from("projects").update(row).eq("id", uuid(b.id)).select("id").single());
    else must(await db().from("projects").insert(row).select("id").single());
    await audit(admin, "project.upsert", { kind, name: row.name });
    return { ok: true };
  },
  async "project.toggle"(b, admin) {
    must(await db().from("projects").update({ is_active: bool(b.active) }).eq("id", uuid(b.id)).select("id").single());
    await audit(admin, "project.toggle", { id: b.id, active: bool(b.active) });
    return { ok: true };
  },

  async "opportunities.list"() {
    return { items: must(await db().from("opportunities").select("id,kind,title,target_label,description,apply_url,is_active,expires_at,sort_order").order("is_active", { ascending: false }).order("created_at", { ascending: false }).limit(200)) };
  },
  async "opportunity.upsert"(b, admin) {
    const row = { kind: oneOf(b.kind, OPP_KINDS, "invalid_kind"), title: text(b.title, { min: 3, max: 120, code: "invalid_title" }),
      target_label: text(b.target_label, { max: 120 }), description: text(b.description, { max: 800 }),
      apply_url: httpUrl(b.apply_url), expires_at: isoDate(b.expires_at) };
    if (b.id) must(await db().from("opportunities").update(row).eq("id", uuid(b.id)).select("id").single());
    else must(await db().from("opportunities").insert(row).select("id").single());
    await audit(admin, "opportunity.upsert", { title: row.title });
    return { ok: true };
  },
  async "opportunity.toggle"(b, admin) {
    must(await db().from("opportunities").update({ is_active: bool(b.active) }).eq("id", uuid(b.id)).select("id").single());
    await audit(admin, "opportunity.toggle", { id: b.id, active: bool(b.active) });
    return { ok: true };
  },

  async "social.list"() {
    return { items: must(await db().from("social_accounts").select("id,platform,label,url,is_active,sort_order").order("sort_order")) };
  },
  async "social.upsert"(b, admin) {
    const row = { platform: text(b.platform, { min: 2, max: 30, code: "invalid_name" }), label: text(b.label, { min: 1, max: 60, code: "invalid_name" }),
      url: httpUrl(b.url) ?? (() => { throw new ValidationError("invalid_url"); })() };
    if (b.id) must(await db().from("social_accounts").update(row).eq("id", uuid(b.id)).select("id").single());
    else must(await db().from("social_accounts").insert(row).select("id").single());
    await audit(admin, "social.upsert", { platform: row.platform });
    return { ok: true };
  },
  async "social.toggle"(b, admin) {
    must(await db().from("social_accounts").update({ is_active: bool(b.active) }).eq("id", uuid(b.id)).select("id").single());
    await audit(admin, "social.toggle", { id: b.id });
    return { ok: true };
  },

  async "settings.get"() {
    const rows = must(await db().from("site_settings").select("key,value").in("key", ["hero_image_url", "bot_users_total"]));
    const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { hero_image_url: m.hero_image_url?.url ?? null, bot_users_total: m.bot_users_total?.n ?? null };
  },
  async "settings.set"(b, admin) {
    const up = (key, value) => db().from("site_settings").upsert({ key, value, updated_at: new Date().toISOString() }).then(must);
    if ("hero_image_url" in b) await up("hero_image_url", { url: imageRef(b.hero_image_url) });
    if ("bot_users_total" in b) {
      const n = b.bot_users_total === null || b.bot_users_total === "" ? 0 : Number(b.bot_users_total);
      if (!Number.isInteger(n) || n < 0 || n > 1e9) throw new ValidationError("invalid_number");
      await up("bot_users_total", { n });
    }
    await audit(admin, "settings.set", { keys: Object.keys(b).filter((k) => k !== "action") });
    return { ok: true };
  },

  // ---- المعاينة: الأدمن يختار الكيان ثم يرسل 1-3 رسائل للبوت ثم يحفظ ----
  async "preview.start"(b, admin) {
    const entity_id = uuid(b.entity_id);
    const e = must(await db().from("entities").select("name").eq("id", entity_id).single());
    must(await db().from("preview_sessions").upsert({ admin_id: admin.telegram_user_id, entity_id, messages: [], started_at: new Date().toISOString() }, { onConflict: "admin_id" }));
    return { ok: true, entity: e.name };
  },
  async "preview.status"(_b, admin) {
    const s = must(await db().from("preview_sessions").select("entity_id,messages,started_at").eq("admin_id", admin.telegram_user_id).limit(1))[0];
    if (!s) return { active: false };
    const e = must(await db().from("entities").select("name").eq("id", s.entity_id).single());
    return { active: true, entity: e.name, count: s.messages.length,
      items: s.messages.map((m) => ({ type: m.message_type, text: String(m.text_content || m.caption || "").slice(0, 80), album: m.album_items?.length ?? 0 })) };
  },
  async "preview.save"(_b, admin) {
    const { data, error } = await db().rpc("save_preview_session", { p_admin: admin.telegram_user_id });
    if (error) throw new ValidationError(/empty_session/.test(error.message) ? "empty_session" : /no_session/.test(error.message) ? "no_session" : "save_failed");
    await audit(admin, "preview.save", { count: data });
    return { ok: true, saved: data };
  },
  async "preview.cancel"(_b, admin) {
    must(await db().from("preview_sessions").delete().eq("admin_id", admin.telegram_user_id));
    return { ok: true };
  },

  async "users.search"(b) {
    const term = String(b.q ?? "").trim().slice(0, 40);
    if (!term) return { items: [] };
    const cols = "telegram_user_id,first_name,last_name,username,referrals_count,has_badge,is_banned,last_seen_at,created_at";
    if (/^\d{1,15}$/.test(term)) return { items: must(await db().from("telegram_users").select(cols).eq("telegram_user_id", Number(term)).limit(5)) };
    const t = term.replace(/[^\p{L}\p{N}_]/gu, "");
    if (!t) return { items: [] };
    return { items: must(await db().from("telegram_users").select(cols).or(`username.ilike.%${t}%,first_name.ilike.%${t}%,last_name.ilike.%${t}%`).limit(10)) };
  },

  async "contact.list"() {
    return { items: must(await db().from("contact_messages").select("id,name,contact,message,is_read,created_at").order("created_at", { ascending: false }).limit(30)) };
  },
  async "audit.list"() {
    return { items: must(await db().from("audit_log").select("id,admin_id,action,detail,created_at").order("created_at", { ascending: false }).limit(50)) };
  },

  // المزامنة ينفّذها البوت (هو من يكلّم تيليجرام): نضع مهمة في الطابور فقط.
  async "sync.request"(b, admin) {
    const payload = b.entity_id ? { entity_id: uuid(b.entity_id) } : {};
    must(await db().from("bot_jobs").insert({ kind: "sync", payload }).select("id").single());
    await audit(admin, "sync.request", payload);
    return { ok: true };
  },

  // استيراد قائمة جاهزة دفعة واحدة. يتخطى المكرر، ويُبلغ بكل سطر مرفوض وسببه، ولا يحذف شيئًا.
  async "import.run"(b, admin) {
    const kind = oneOf(b.kind, ["entities", "projects", "social"], "invalid_kind");
    const text = String(b.text ?? "");
    if (text.length > 60000) throw new ValidationError("too_many_lines");
    const d = db();
    let rows, problems, created = 0, skipped = 0;
    if (kind === "entities") {
      ({ rows, problems } = parseEntities(text, must(await d.from("categories").select("id,entity_type,label_ar").eq("is_active", true))));
      const existing = must(await d.from("entities").select("entity_type,telegram_username,name").limit(5000));
      const have = new Set(existing.map((e) => `${e.entity_type}:${(e.telegram_username ?? "").toLowerCase() || e.name}`));
      const fresh = rows.filter((r) => { const k = `${r.entity_type}:${(r.telegram_username ?? "").toLowerCase() || r.name}`; if (have.has(k)) { skipped++; return false; } return true; });
      if (fresh.length) {
        const now = new Date().toISOString();
        must(await d.from("entities").insert(fresh.map((r) => ({ ...r, slug: slugify(r.name, rand()), bot_functions: [], status: "active",
          approved_at: now, is_new: false, name_locked: true, desc_locked: true }))));
        created = fresh.length;
      }
    } else if (kind === "projects") {
      ({ rows, problems } = parseProjects(text));
      const existing = must(await d.from("projects").select("kind,name").limit(2000));
      const have = new Set(existing.map((p) => `${p.kind}:${p.name}`));
      const fresh = rows.filter((r) => { if (have.has(`${r.kind}:${r.name}`)) { skipped++; return false; } return true; });
      if (fresh.length) { must(await d.from("projects").insert(fresh)); created = fresh.length; }
    } else {
      ({ rows, problems } = parseSocial(text));
      const existing = must(await d.from("social_accounts").select("url").limit(500));
      const have = new Set(existing.map((s) => s.url));
      const fresh = rows.filter((r) => { if (have.has(r.url)) { skipped++; return false; } return true; });
      if (fresh.length) { must(await d.from("social_accounts").insert(fresh)); created = fresh.length; }
    }
    await audit(admin, "import.run", { kind, created, skipped, rejected: problems.length });
    return { ok: true, created, skipped, problems: problems.slice(0, 50), max: MAX_LINES };
  },

  // استيراد من روابط تيليجرام وغيرها: يجلب الاسم والوصف والعدد والصورة من صفحة t.me العامة،
  // ويحدد النوع ويقترح التصنيف. حتى 25 رابطًا في الطلب (الواجهة تقسّم القوائم الطويلة).
  async "import.links"(b, admin) {
    const urls = Array.isArray(b.urls) ? b.urls.map(String).slice(0, 25) : [];
    if (!urls.length) throw new ValidationError("nothing_to_update");
    const d = db();
    const cats = must(await d.from("categories").select("id,entity_type,label_ar").eq("is_active", true));
    const ents = must(await d.from("entities").select("entity_type,telegram_username,invite_url").limit(5000));
    const haveEnt = new Set(ents.flatMap((e) => [e.telegram_username ? `${e.entity_type}:${e.telegram_username.toLowerCase()}` : null, e.invite_url].filter(Boolean)));
    const haveSocial = new Set(must(await d.from("social_accounts").select("url").limit(500)).map((x) => x.url));
    const haveProj = new Set(must(await d.from("projects").select("url").limit(2000)).map((x) => x.url).filter(Boolean));
    const AR = { WhatsApp: "واتساب", Facebook: "فيسبوك", Instagram: "إنستغرام", TikTok: "تيك توك", Threads: "ثريدز", X: "إكس", Pinterest: "بنترست" };

    async function fetchPage(link) {
      const target = tmeFetchUrl(link);
      const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), 6000);
      try {
        const r = await fetch(target, { signal: ctrl.signal, redirect: "follow", headers: { "accept-language": "en", "user-agent": "Mozilla/5.0 (compatible; AtharAwwabImport/1.0)" } });
        if (!r.ok || !/(^|\.)(t|telegram)\.me$/.test(new URL(r.url).hostname)) return null;
        return parseTmePage(await r.text());
      } catch { return null; } finally { clearTimeout(timer); }
    }

    const results = new Array(urls.length);
    let next = 0;
    await Promise.all(Array.from({ length: 6 }, async () => {
      while (next < urls.length) {
        const i = next++, url = urls[i], link = classifyLink(url);
        if (link.kind === "invalid") { results[i] = { url, status: "problem", reason: "رابط غير مفهوم" }; continue; }
        if (link.kind === "social" || link.kind === "unknown") { results[i] = { url, link }; continue; }
        const page = await fetchPage(link);
        results[i] = { url, link, page };
      }
    }));

    const entityRows = [], socialRows = [], projectRows = [], report = [];
    const labelsUsed = new Map();
    for (const r of results) {
      const { url, link, page } = r;
      if (r.status === "problem") { report.push(r); continue; }
      if (link.kind === "social") {
        if (haveSocial.has(link.url)) { report.push({ url, status: "skipped", reason: "موجود مسبقًا" }); continue; }
        const base = AR[link.platform] ?? link.platform, n = (labelsUsed.get(base) ?? 0) + 1; labelsUsed.set(base, n);
        socialRows.push({ platform: link.platform, label: n > 1 ? `${base} (${n})` : base, url: link.url }); haveSocial.add(link.url);
        report.push({ url, status: "created", type: "حساب تواصل", name: link.platform }); continue;
      }
      if (link.kind === "unknown") {
        const u = httpUrl(link.url);
        if (haveProj.has(u)) { report.push({ url, status: "skipped", reason: "موجود مسبقًا" }); continue; }
        const host = new URL(u).hostname.replace(/^www\./, "");
        projectRows.push({ kind: "website", name: host, url: u }); haveProj.add(u);
        report.push({ url, status: "created", type: "موقع (الاسم مؤقت: عدّله من المشاريع)", name: host }); continue;
      }
      // روابط تيليجرام
      if (!page) { report.push({ url, status: "problem", reason: "تعذّر جلب الصفحة (حاول لاحقًا)" }); continue; }
      if ((link.kind === "channel" || link.kind === "invite") && (!page.resolved || page.kind === "account")) {
        report.push({ url, status: "problem", reason: page.kind === "account" ? "الرابط لحساب مستخدم لا قناة/جروب" : "الرابط غير صالح أو منتهٍ" }); continue;
      }
      const row = buildEntityRow(link, page, cats);
      if (!row) { report.push({ url, status: "problem", reason: "لا اسم متاح" }); continue; }
      const u = row.telegram_username?.toLowerCase();
      const dupe = row.invite_url ? haveEnt.has(row.invite_url)
        : (row.entity_type === "bot" || row.entity_type === "sticker_pack") ? haveEnt.has(`${row.entity_type}:${u}`)
        : haveEnt.has(`channel:${u}`) || haveEnt.has(`group:${u}`);
      if (dupe) { report.push({ url, status: "skipped", reason: "موجود مسبقًا" }); continue; }
      haveEnt.add(row.invite_url ?? `${row.entity_type}:${u}`); entityRows.push(row);
      report.push({ url, status: "created", type: { channel: "قناة", group: "جروب", bot: "بوت", sticker_pack: "ملصقات" }[row.entity_type],
        name: row.name, category: row.category_id ? cats.find((c) => c.id === row.category_id)?.label_ar : "بلا تصنيف (حدّده لاحقًا)" });
    }
    const now = new Date().toISOString();
    if (entityRows.length) must(await d.from("entities").insert(entityRows.map((r) => ({ ...r, slug: slugify(r.name, rand()), bot_functions: [], status: "active", approved_at: now, is_new: false }))));
    if (socialRows.length) must(await d.from("social_accounts").insert(socialRows));
    if (projectRows.length) must(await d.from("projects").insert(projectRows));
    await audit(admin, "import.links", { entities: entityRows.length, social: socialRows.length, projects: projectRows.length });
    return { ok: true, report, created: entityRows.length + socialRows.length + projectRows.length };
  },

  async "zanati.ask"(b) {
    const q = String(b.question ?? "").trim();
    if (!q || q.length > 500) throw new ValidationError("invalid_question");
    return await askZanati(q);
  },
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const json = (status, body) => res.status(status).json(body);
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const user = verifyInitData(req.headers["x-telegram-init-data"], process.env.TELEGRAM_BOT_TOKEN);
  if (!user) return json(401, { error: "unauthorized" });

  try {
    const rows = must(await db().from("admins").select("telegram_user_id,role,is_active").eq("telegram_user_id", user.id).limit(1));
    const admin = rows[0];
    if (!admin?.is_active) return json(403, { error: "forbidden" });

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
    const action = String(body.action ?? "");
    if (!Object.hasOwn(actions, action)) return json(400, { error: "unknown_action" });
    if (!roleAllows(admin.role, action)) return json(403, { error: "forbidden" });

    const out = await actions[action](body, admin);
    return json(200, { ...out, _role: admin.role });
  } catch (err) {
    if (err instanceof ValidationError) return json(400, { error: err.code });
    console.error("admin error:", err?.message);
    return json(500, { error: "server_error" });
  }
}
