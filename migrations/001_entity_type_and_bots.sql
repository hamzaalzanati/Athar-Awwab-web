-- =========================================================
-- Migration 001: entity_type + bot_function + migrate hardcoded bots
-- =========================================================
-- ليه الميجريشن ده لازم؟
-- جدول channels دلوقتي بيمثل بس "القنوات" (category = quran/sunnah/...).
-- الـ 24 بوت الظاهرين في الموقع العام دلوقتي مش صفوف حقيقية في القاعدة
-- خالص — هما Array ثابت جوه index.html. ده معناه إن الأدمن مش قادر
-- يضيف/يعدّل/يخفي بوت من لوحة التحكم، ولو ضاف بوت جديد من admin.js
-- (بعد التحديث اللي جاي) هيتسجل في القاعدة بس الموقع العام مش هيشوفه
-- غير بعد ما نوصل الموقع بالـ API (خطوة تالية منفصلة، مش في الميجريشن ده).
--
-- المبدأ: مفيش حذف ولا إعادة بناء لجدول channels. إضافة أعمدة بس،
-- وإدخال بيانات حقيقية (نفس الـ 24 بوت الموجودين فعليًا في الكود)،
-- مش بيانات وهمية.
--
-- طريقة التشغيل: افتح Supabase → SQL Editor → الصق الملف ده كامل → Run.
-- آمن للتشغيل أكتر من مرة (idempotent) بفضل IF NOT EXISTS / WHERE NOT EXISTS.
-- =========================================================

-- 1) عمود نوع الكيان: channel / bot / group / sticker
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS entity_type text NOT NULL DEFAULT 'channel';

DO $$ BEGIN
  ALTER TABLE channels
    ADD CONSTRAINT channels_entity_type_check
    CHECK (entity_type IN ('channel','bot','group','sticker'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) التصنيف الوظيفي للبوتات فقط (مطابق لـ §11/§20 في مواصفات المشروع:
--    محتوى فوري / نشر لقناتك / استقبال محتوى للقنوات / بوتات خدمية / تواصل)
ALTER TABLE channels
  ADD COLUMN IF NOT EXISTS bot_function text;

-- 3) الصفوف الحالية كلها "قنوات" فعليًا (احتياطًا، الـ DEFAULT أصلًا بيغطيها)
UPDATE channels SET entity_type = 'channel' WHERE entity_type IS NULL;

-- 4) ترحيل الـ 24 بوت الحقيقيين من index.html إلى صفوف فعلية في القاعدة
--    (WHERE NOT EXISTS يمنع التكرار لو شغّلت الميجريشن أكتر من مرة)

-- --- محتوى فوري ---
INSERT INTO channels (name, url, description, entity_type, bot_function, category)
SELECT * FROM (VALUES
  ('بوت أَثَر', 'https://t.me/Islami4488BoT', 'موسوعة إسلامية شاملة: القرآن بروايات متعددة، السيرة النبوية، أذكار، وتفسير مترجم لأكثر من 15 لغة', 'bot', 'content_instant', NULL),
  ('بوت معين', 'https://t.me/Azkar_4_BOT', 'أذكار الصباح والمساء، أذكار الصلاة والنوم، أدعية، وسور مختارة', 'bot', 'content_instant', NULL),
  ('بوت القرآن الكريم', 'https://t.me/Quran_hz4bot', 'تصفح واستماع وتفسير بأكثر من 120 قارئ وترجمات لعدة لغات', 'bot', 'content_instant', 'quran'),
  ('بوت السيرة النبوية', 'https://t.me/quran_hzbot', 'معلومات عن النبي ﷺ، والتحقق من صحة الأحاديث', 'bot', 'content_instant', 'sunnah'),
  ('بوت نور', 'https://t.me/noorai_hzbot', 'ذكاء اصطناعي مدرَّب على المحتوى الإسلامي', 'bot', 'content_instant', NULL),
  ('مشكاة النور', 'https://t.me/MISHKAT_hzbot', 'متابعة وردك القرآني اليومي بإحصائيات وتذكيرات ذكية', 'bot', 'content_instant', 'quran'),
  ('بوت مسبحتي', 'https://t.me/sabha_hz_bot', 'تسبيح إلكتروني بسيط داخل تليجرام مباشرة', 'bot', 'content_instant', NULL),
  ('بوت مؤنسات', 'https://t.me/Moanesat_hzBot', NULL, 'bot', 'content_instant', NULL),
  ('بوت المكتبة الإسلامية', 'https://t.me/Islami4488_v2_BoT', NULL, 'bot', 'content_instant', NULL),
  ('بوت سورة الكهف', 'https://t.me/Surat_AlKahf_hzbot', 'نص وصور من المصحف وتلاوة وتفسير مسموع', 'bot', 'content_instant', 'quran'),
  ('بوت سورة البقرة', 'https://t.me/Surat_AlBaqarah_hzbot', 'نص وصور من المصحف وتفسير مرئي ومسموع', 'bot', 'content_instant', 'quran'),
  ('ليطمئن قلبك', 'https://t.me/lqlbk_hz_bot', 'رسائل تحفيزية وأدعية وتلاوات مختارة', 'bot', 'content_instant', 'selfdev')
) AS v(name, url, description, entity_type, bot_function, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- نشر لقناتك ---
INSERT INTO channels (name, url, description, entity_type, bot_function, category)
SELECT * FROM (VALUES
  ('بوت نشر الأحاديث والسنن', 'https://t.me/Quran_hz2_bot', 'ينشر أحاديث صحيحة تلقائيًا في قناتك', 'bot', 'publish_to_your_channel', 'sunnah'),
  ('بوت رفيقك في الإسلام', 'https://t.me/Quran_hz1Bot', NULL, 'bot', 'publish_to_your_channel', NULL),
  ('بوت ورد القرآني', 'https://t.me/QURAN_hz_bot', 'ينشر حزبًا يوميًا في قناتك ضمن خطة ختمة', 'bot', 'publish_to_your_channel', 'quran'),
  ('بوت إسلامي نور قلبي', 'https://t.me/Quran_hz4_bot', 'ينشر تلقائيًا تلاوات وأدعية وأذكار يومية', 'bot', 'publish_to_your_channel', NULL)
) AS v(name, url, description, entity_type, bot_function, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- استقبال محتوى للقنوات ---
INSERT INTO channels (name, url, description, entity_type, bot_function, category)
SELECT * FROM (VALUES
  ('بوت صدقة جارية', 'https://t.me/Gaza_44_bot', NULL, 'bot', 'content_intake', NULL),
  ('بوت لا تحزن إن الله معنا', 'https://t.me/quran_h4_bot', NULL, 'bot', 'content_intake', NULL)
) AS v(name, url, description, entity_type, bot_function, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- بوتات خدمية ---
INSERT INTO channels (name, url, description, entity_type, bot_function, category)
SELECT * FROM (VALUES
  ('بوت حماية مجموعات', 'https://t.me/Palestine_hz1_bot', NULL, 'bot', 'utility', NULL),
  ('بوت تحويل صيغ ملفات', 'https://t.me/Spread4487_bot', NULL, 'bot', 'utility', NULL),
  ('صانع بوتات', 'https://t.me/PotatMaker_bot', 'اصنع بوتك الخاص بدون أي برمجة', 'bot', 'utility', NULL),
  ('صانع منشورات متطورة', 'https://t.me/List_blackBot', NULL, 'bot', 'utility', NULL)
) AS v(name, url, description, entity_type, bot_function, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- تواصل ---
INSERT INTO channels (name, url, description, entity_type, bot_function, category)
SELECT * FROM (VALUES
  ('بوت تواصل (خاص ببوتات المحتوى)', 'https://t.me/Mslm_hz_bot', NULL, 'bot', 'contact', NULL),
  ('بوت تواصل عام', 'https://t.me/Toasl_official_Bot', NULL, 'bot', 'contact', NULL)
) AS v(name, url, description, entity_type, bot_function, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- 5) فهرس يفيد فلترة الأدمن والموقع العام حسب النوع
CREATE INDEX IF NOT EXISTS idx_channels_entity_type ON channels (entity_type);
