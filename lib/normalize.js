// توحيد الحروف العربية للبحث (مطابق لدالة normalize_ar في قاعدة البيانات)
export function normalizeAr(s) {
  return String(s ?? "")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase();
}

// مرادفات شائعة: كل مجموعة تُعامَل ككلمة واحدة في البحث
const SYNONYMS = [
  ["قران", "القران", "مصحف", "تلاوه", "تلاوات"],
  ["سيره", "السيره", "نبي", "النبويه"],
  ["اذكار", "ذكر", "اذكاري"],
  ["تطوير", "تحفيز", "تنميه"],
  ["ملصقات", "استيكر", "ستيكر", "ستكرات"],
  ["بوت", "بوتات", "روبوت"],
  ["جروب", "جروبات", "مجموعه", "مجموعات"],
];

export function expandToken(token) {
  const group = SYNONYMS.find((g) => g.includes(token));
  return group ? [...group] : [token];
}

/** كلمات البحث: حروف وأرقام فقط (لا رموز تدخل في فلاتر PostgREST)، حتى 5 كلمات. */
export function searchTokens(query) {
  const cleaned = normalizeAr(query).replace(/[^\p{L}\p{N}\s]/gu, " ");
  return cleaned.split(/\s+/).filter((t) => t.length >= 2).slice(0, 5).map((t) => t.slice(0, 30));
}

/** ترتيب النتائج: تطابق الاسم أولًا ثم بداية الاسم ثم الوصف، ثم الأكثر متابعة. */
export function rankResults(rows, query) {
  const q = normalizeAr(query).trim();
  const score = (r) => {
    const n = normalizeAr(r.name);
    let s = 0;
    if (n === q) s += 100;
    else if (n.startsWith(q)) s += 60;
    else if (n.includes(q)) s += 40;
    if (normalizeAr(r.short_description).includes(q)) s += 10;
    if (r.is_featured) s += 5;
    return s;
  };
  return [...rows].sort((a, b) => score(b) - score(a) || (b.subscriber_count ?? 0) - (a.subscriber_count ?? 0));
}

export function slugify(title, suffix) {
  const base = String(title).trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u0600-\u06FF-]/g, "").slice(0, 60);
  return `${base || "item"}-${suffix}`;
}
