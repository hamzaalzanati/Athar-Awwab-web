import { db, must } from "./db.js";
import { expandToken, rankResults, searchTokens } from "./normalize.js";

const CARD = "id,slug,entity_type,name,short_description,image_url,subscriber_count,subscriber_count_hidden,is_featured,category_id";
const notExpired = () => `expires_at.is.null,expires_at.gt.${new Date().toISOString()}`;

async function countActive(type) {
  const { count, error } = await db().from("entities").select("id", { count: "exact", head: true })
    .eq("status", "active").eq("entity_type", type);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getSettings() {
  const rows = must(await db().from("site_settings").select("key,value").in("key", ["hero_image_url", "bot_users_total"]));
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { heroImageUrl: m.hero_image_url?.url ?? null, botUsersTotal: Number(m.bot_users_total?.n) || 0 };
}

export async function getProjects(kind, limit = 50) {
  return must(await db().from("projects").select("id,name,description,url,image_url,expires_at").eq("kind", kind)
    .eq("is_active", true).or(notExpired()).order("sort_order").order("created_at", { ascending: false }).limit(limit));
}

export async function getOpportunities(limit = 50) {
  return must(await db().from("opportunities").select("id,kind,title,target_label,description,apply_url,expires_at")
    .eq("is_active", true).or(notExpired()).order("sort_order").order("created_at", { ascending: false }).limit(limit));
}

export async function getSocial() {
  return must(await db().from("social_accounts").select("platform,label,url").eq("is_active", true).order("sort_order"));
}

export async function getHome() {
  const [channels, bots, groups, stickers, settings, fresh, followed, websites, contributed, supported, help, opportunities, social] =
    await Promise.all([
      countActive("channel"), countActive("bot"), countActive("group"), countActive("sticker_pack"), getSettings(),
      db().from("entities").select(CARD).eq("status", "active").eq("is_new", true).order("created_at", { ascending: false }).limit(8).then(must),
      db().from("entities").select(CARD).eq("status", "active").not("subscriber_count", "is", null)
        .eq("subscriber_count_hidden", false).order("subscriber_count", { ascending: false }).limit(8).then(must),
      getProjects("website", 6), getProjects("contributed", 6), getProjects("supported", 6), getProjects("help", 4),
      getOpportunities(4), getSocial(),
    ]);
  return { counts: { channels, bots, groups, stickers, websites: websites.length }, settings, fresh, followed,
    websites, contributed, supported, help, opportunities, social };
}

export async function listEntities(type, limit = 60) {
  return must(await db().from("entities").select(CARD).eq("status", "active").eq("entity_type", type)
    .order("is_featured", { ascending: false }).order("subscriber_count", { ascending: false, nullsFirst: false })
    .order("name").limit(limit));
}

export async function getEntity(type, slug) {
  if (!/^[\p{L}\p{N}-]{1,120}$/u.test(slug)) return null;
  const rows = must(await db().from("entities").select("*").eq("status", "active").eq("entity_type", type).eq("slug", slug).limit(1));
  const e = rows[0];
  if (!e) return null;
  const [cat, previews] = await Promise.all([
    e.category_id ? db().from("categories").select("label_ar").eq("id", e.category_id).limit(1).then(must) : [],
    db().from("preview_messages").select("id,position,message_type,text_content,caption,file_id,thumb_file_id,album_items,buttons,original_link,original_ts")
      .eq("entity_id", e.id).order("position").then(must),
  ]);
  return { entity: e, categoryLabel: cat[0]?.label_ar ?? null, previews };
}

export async function search(query, limit = 30) {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];
  let q = db().from("entities").select(`${CARD}`).eq("status", "active");
  for (const t of tokens) {
    // كل كلمة (أو أحد مرادفاتها) يجب أن تظهر في الاسم/الوصف. الرموز حُذفت سابقًا فلا حقن في الفلتر.
    q = q.or(expandToken(t).map((v) => `search_text.ilike.%${v}%`).join(","));
  }
  const rows = must(await q.limit(100));
  return rankResults(rows, query).slice(0, limit);
}

export async function sitemapEntities() {
  return must(await db().from("entities").select("entity_type,slug,updated_at").eq("status", "active").limit(5000));
}

export async function getCategories(type) {
  return must(await db().from("categories").select("id,label_ar,sort_order").eq("entity_type", type).eq("is_active", true).order("sort_order"));
}

/** تصنيفات فيها كيانات منشورة فعلًا مع عدّها (لا تصنيف فارغ يظهر للعامة). */
export async function getCategoryOverview() {
  const [cats, ents] = await Promise.all([
    db().from("categories").select("id,entity_type,label_ar,sort_order").eq("is_active", true).then(must),
    db().from("entities").select("category_id").eq("status", "active").not("category_id", "is", null).limit(5000).then(must),
  ]);
  const counts = new Map();
  for (const e of ents) counts.set(e.category_id, (counts.get(e.category_id) ?? 0) + 1);
  return cats.map((c) => ({ ...c, count: counts.get(c.id) ?? 0 })).filter((c) => c.count > 0)
    .sort((a, b) => a.entity_type.localeCompare(b.entity_type) || a.sort_order - b.sort_order);
}
