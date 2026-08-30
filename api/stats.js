/* =========================================================
   api/stats.js — Vercel Serverless Function
   =========================================================
   المصدر الأساسي دلوقتي: قاعدة بيانات Supabase — لأن البوت بقى أدمن
   في كل قنواتك (عامة وخاصة) وبيحدّث فيها الاسم والصورة والوصف وعدد
   المشتركين الدقيق تلقائيًا كل ساعة (شوف syncManagedChats في مشروع
   البوت). الموقع بقى مايعتمدش على بيانات محلية ثابتة ولا قراءة صفحات
   عامة — كل حاجة حية من نفس القاعدة اللي البوت بيحدّثها.

   لو قاعدة البيانات لسه مش متظبطة (SUPABASE_URL/SUPABASE_KEY فاضيين)،
   بيرجع تلقائيًا لقراءة صفحات تليجرام العامة (نفس الطريقة القديمة)
   كخطة احتياطية، عشان الموقع يفضل شغال في كل الأحوال.

   ملاحظة أمان مهمة: مفتاح SUPABASE_KEY هنا لازم يكون Service Role Key
   (صلاحية كاملة) — وده تمام تمامًا لأن الملف ده بيشتغل على السيرفر
   بس، مش في متصفح الزائر. المفتاح ده متحطش أبدًا في أي كود بيشتغل
   جوه المتصفح (زي index.html) — هناك المفروض يبقى مفيش مفتاح خالص.
   ========================================================= */

const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_KEY = process.env.SUPABASE_KEY || null;

async function fetchFromSupabase() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/channels?archived=eq.false&select=url,name,description,subscriber_count,photo_url`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  if (!res.ok) throw new Error("supabase fetch failed");
  const rows = await res.json();

  const channels = {};
  let total = 0;
  for (const row of rows) {
    const m = row.url && row.url.match(/t\.me\/([A-Za-z0-9_]+)$/);
    if (!m) continue;
    channels[m[1]] = {
      count: row.subscriber_count ?? null,
      name: row.name ?? null,
      desc: row.description ?? null,
      photo: row.photo_url ?? null
    };
    if (row.subscriber_count) total += row.subscriber_count;
  }
  return { channels, total, source: "supabase" };
}

/* ---------- خطة احتياطية: قراءة صفحات تليجرام العامة مباشرة (لو DB لسه مش متظبطة) ---------- */
const FALLBACK_USERNAMES = [
  "quran_hz1","quran_hz2","quran_hz24","channls_bots_hz","Al_Quran_446","quran_hz3",
  "Quran_447","Quran_446","Quran_448","aye_quran_hz","quran_hz7","quran_hz9","quran_hz23",
  "quran_hz22","Quran_hz","self_development_4","quran_h4","Oaa_hz1","mnbh_elSlah",
  "mnbhelzkr4","alastghfar_mnbh","quran_hz11","quran_hz12","quran_hz10","quran_hz13",
  "quran_hz14","Quran_hz4","quran_hz15","tawheed8","Mslm_hz","Taakbeer","quran_hz6",
  "quran_hz5","quran_hz21","quran_hz20","QURAN_hz36","quran_hz27","quran_hz17","quran_hz29",
  "quran_hz18","quran_hz25","quran_hz19","quran_hz28","quran_hz8","quran_hz26","Quran_hz30",
  "QURAN_hz31","QURAN_hz32","QURAN_hz33","QURAN_hz34","QURAN_hz37","nzer_hz","quran_hz35",
  "Islami4488BoT","Azkar_4_BOT","Quran_hz4bot","quran_hzbot","noorai_hzbot","MISHKAT_hzbot",
  "sabha_hz_bot","Moanesat_hzBot","Islami4488_v2_BoT","Surat_AlKahf_hzbot",
  "Surat_AlBaqarah_hzbot","lqlbk_hz_bot","Quran_hz2_bot","Quran_hz1Bot","QURAN_hz_bot",
  "Quran_hz4_bot","Gaza_44_bot","quran_h4_bot","Palestine_hz1_bot","Spread4487_bot",
  "PotatMaker_bot","List_blackBot","Mslm_hz_bot"
];

async function fetchInfo(username) {
  try {
    const res = await fetch(`https://t.me/${username}`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AtharAwwabBot/1.0)" }
    });
    if (!res.ok) return null;
    const html = await res.text();
    const countM = html.match(/([\d\s,.]+)\s*(subscribers|members)/i);
    const count = countM ? parseInt(countM[1].replace(/[^\d]/g, ""), 10) : null;
    const titleM = html.match(/property="og:title"\s+content="([^"]*)"/i);
    const descM = html.match(/property="og:description"\s+content="([^"]*)"/i);
    const imgM = html.match(/property="og:image"\s+content="([^"]*)"/i);
    return {
      count: Number.isFinite(count) ? count : null,
      name: titleM ? titleM[1] : null,
      desc: descM ? descM[1] : null,
      photo: imgM ? imgM[1] : null
    };
  } catch (e) {
    return null;
  }
}

async function fetchFromScraping() {
  const results = await Promise.all(FALLBACK_USERNAMES.map(async (u) => [u, await fetchInfo(u)]));
  const channels = {};
  let total = 0;
  for (const [username, info] of results) {
    if (info) {
      channels[username] = info;
      if (info.count != null) total += info.count;
    }
  }
  return { channels, total, source: "scraping_fallback" };
}

module.exports = async (req, res) => {
  let result;
  try {
    if (SUPABASE_URL && SUPABASE_KEY) {
      result = await fetchFromSupabase();
    } else {
      result = await fetchFromScraping();
    }
  } catch (e) {
    // لو Supabase فشل لأي سبب، نرجع لخطة القراءة المباشرة بدل ما الموقع يتعطل
    result = await fetchFromScraping().catch(() => ({ channels: {}, total: 0, source: "none" }));
  }

  res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=900");
  res.status(200).json({
    channels: result.channels,
    total: result.total,
    source: result.source,
    resolved: Object.keys(result.channels).length,
    updated: new Date().toISOString()
  });
};
