-- =========================================================
-- Migration 002: migrate the hand-curated channel catalog
-- (QURAN/SUNNAH/READERS/REMINDERS/SELFDEV/QUOTES/STICKERS)
-- from index.html's static JS arrays into real channels rows.
-- =========================================================
-- ليه محتاجين الميجريشن ده؟
-- نفس سبب ميجريشن البوتات (001): تصنيف/وصف القنوات الظاهرة
-- في الموقع العام دلوقتي Array ثابت في index.html، مش عمود
-- category/description الحقيقي في جدول channels. فلو الأدمن غيّر
-- تصنيف قناة أو أخفاها من لوحة التحكم، الموقع العام مش هيتأثر.
--
-- آمن للتشغيل أكتر من مرة: أي قناة URL موجود بالفعل في channels
-- (سواء اتضافت يدويًا قبل كده أو من مزامنة البوت) *مش هتتكرر*
-- ولا هتتلمس بياناتها الحالية — الإدراج بس للصفوف الناقصة.

-- --- القرآن الكريم (15) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('إسلامي نور قلبي', 'https://t.me/quran_hz1', 'القناة الرئيسية بذكر الله تنجلي الهموم', 'channel', 'quran'),
  ('مقاطع قرآنية | تصميمات دينية', 'https://t.me/quran_hz2', 'مقاطع ومرئيات قرآنية مصممة بعناية', 'channel', 'quran'),
  ('للأجر لي ولكم', 'https://t.me/quran_hz24', 'محتوى دعوي للنشر والمشاركة', 'channel', 'quran'),
  ('القرآن الكريم | صوتيات ومرئيات إسلامية', 'https://t.me/Al_Quran_446', 'القرآن كاملًا بصوت مرتل ومجوّد ومعلَّم', 'channel', 'quran'),
  ('القرآن الكريم | تدبر وعمل', 'https://t.me/quran_hz3', 'وقفات تدبرية مع آيات القرآن الكريم', 'channel', 'quran'),
  ('المكتبة الإسلامية | مصاحف وكتب', 'https://t.me/Quran_447', 'مصاحف وكتب إسلامية متنوعة للتحميل', 'channel', 'quran'),
  ('بالقرآن تطمئن قلوب', 'https://t.me/Quran_446', 'آيات مختارة للطمأنينة اليومية', 'channel', 'quran'),
  ('سور قرآنية', 'https://t.me/Quran_448', 'سور كاملة مرتلة بجودة عالية', 'channel', 'quran'),
  ('آيـة', 'https://t.me/aye_quran_hz', 'آية واحدة يوميًا للتأمل والتدبر', 'channel', 'quran'),
  ('أنيس مسلم', 'https://t.me/quran_hz7', 'لتدبر الآيات ومرافقة القرآن يوميًا', 'channel', 'quran'),
  ('وردك اليومي', 'https://t.me/quran_hz9', 'القرآن الكريم والأذكار كورد يومي ثابت', 'channel', 'quran'),
  ('ختم القرآن الكريم كل 31 يوم', 'https://t.me/quran_hz23', 'ورد قرآن 5 مرات يوميًا لختمة شهرية', 'channel', 'quran'),
  ('وردك قرآني اليومي', 'https://t.me/+wGeHhtBieC42NDZk', 'ختمة قرآنية كاملة كل شهرين', 'channel', 'quran'),
  ('ختمة قرآنية كل 15 يوم', 'https://t.me/+QIj8vdhU7xozZDNk', 'برنامج ختم سريع للقرآن الكريم', 'channel', 'quran'),
  ('ختم سورة البقرة يوميًا', 'https://t.me/quran_hz22', 'جزء يومي ثابت من سورة البقرة', 'channel', 'quran')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- السيرة النبوية (1) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('السيرة النبوية', 'https://t.me/Quran_hz', 'أحاديث وسنة النبي ﷺ ومقاطع مختصرة عن السيرة العطرة.', 'channel', 'sunnah')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- القراء (12) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('الشيخ عبدالباسط عبدالصمد', 'https://t.me/+dOglmKK6jWcyNGRk', NULL, 'channel', 'readers'),
  ('الشيخ ياسر الدوسري', 'https://t.me/+l80rS3oCpmU1YjBk', NULL, 'channel', 'readers'),
  ('الشيخ مشاري راشد', 'https://t.me/+XSlLgUE84k45ZTZk', NULL, 'channel', 'readers'),
  ('الشيخ أحمد العجمي', 'https://t.me/+g26OWIkr5EtjY2Zk', NULL, 'channel', 'readers'),
  ('الشيخ سعد الغامدي', 'https://t.me/+y2mxZgoXGwUxNjI8', NULL, 'channel', 'readers'),
  ('الشيخ محمود خليل الحصري', 'https://t.me/+gfReGKFk5jE2MTE0', NULL, 'channel', 'readers'),
  ('الشيخ أبوبكر الشاطري', 'https://t.me/+6m0i69JqJiZiMzA8', NULL, 'channel', 'readers'),
  ('الشيخ سعود الشريم', 'https://t.me/+6g320MWAPfY2ZDg8', NULL, 'channel', 'readers'),
  ('الشيخ محمد صديق المنشاوي', 'https://t.me/+bTxdZt7WwvhlNmNk', NULL, 'channel', 'readers'),
  ('الشيخ أيمن رشدي سويد', 'https://t.me/+_B4e8LxW4QMwNzE0', NULL, 'channel', 'readers'),
  ('القرآن الكريم مقسم صفحات للقراءة', 'https://t.me/+-1jAJ5HN_Dw2ZWRk', 'لتسهيل القراءة اليومية صفحة بصفحة', 'channel', 'readers'),
  ('ختمة قرآنية مقسمة لشهر رمضان', 'https://t.me/+AB1KBbQ0-Q83YmVk', 'برنامج ختمة خاص بشهر رمضان المبارك', 'channel', 'readers')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- منبهات دينية (36) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('منبه الصلاة على النبي ﷺ', 'https://t.me/mnbh_elSlah', NULL, 'channel', 'reminders'),
  ('منبه الحوقلة وذكر الله', 'https://t.me/mnbhelzkr4', NULL, 'channel', 'reminders'),
  ('منبه الاستغفار', 'https://t.me/alastghfar_mnbh', NULL, 'channel', 'reminders'),
  ('منبه الباقيات الصالحات', 'https://t.me/quran_hz11', NULL, 'channel', 'reminders'),
  ('منبه التسبيح', 'https://t.me/quran_hz12', NULL, 'channel', 'reminders'),
  ('منبه النوافل', 'https://t.me/quran_hz10', NULL, 'channel', 'reminders'),
  ('منبه التحميد', 'https://t.me/quran_hz13', NULL, 'channel', 'reminders'),
  ('منبه دعاء ذي النون', 'https://t.me/quran_hz14', NULL, 'channel', 'reminders'),
  ('منبه دعاء كفاية العبد', 'https://t.me/Quran_hz4', NULL, 'channel', 'reminders'),
  ('منبه المنجية والكافية', 'https://t.me/quran_hz15', NULL, 'channel', 'reminders'),
  ('منبه الذكر العظيم', 'https://t.me/tawheed8', NULL, 'channel', 'reminders'),
  ('منبه أذكار الصباح والمساء', 'https://t.me/Mslm_hz', NULL, 'channel', 'reminders'),
  ('منبه التكبير', 'https://t.me/Taakbeer', NULL, 'channel', 'reminders'),
  ('منبه اللهم اعفُ عنا', 'https://t.me/quran_hz6', NULL, 'channel', 'reminders'),
  ('منبه دعاء ثبات القلب', 'https://t.me/quran_hz5', NULL, 'channel', 'reminders'),
  ('منبه سورة الإخلاص', 'https://t.me/quran_hz21', NULL, 'channel', 'reminders'),
  ('منبه قيام الليل', 'https://t.me/quran_hz20', NULL, 'channel', 'reminders'),
  ('منبه صلاة الضحى', 'https://t.me/+sExSzcDj0s9kNmE8', NULL, 'channel', 'reminders'),
  ('منبه حسبنا الله ونعم الوكيل', 'https://t.me/QURAN_hz36', NULL, 'channel', 'reminders'),
  ('منبه دعاء موسى عليه السلام', 'https://t.me/quran_hz27', NULL, 'channel', 'reminders'),
  ('منبه دعاء الكرب', 'https://t.me/quran_hz17', NULL, 'channel', 'reminders'),
  ('منبه دعاء أيوب عليه السلام', 'https://t.me/quran_hz29', NULL, 'channel', 'reminders'),
  ('منبه تاج التحصين', 'https://t.me/quran_hz18', NULL, 'channel', 'reminders'),
  ('ادعوني أستجب لكم', 'https://t.me/quran_hz25', NULL, 'channel', 'reminders'),
  ('منبه تاج الدعاء', 'https://t.me/quran_hz19', NULL, 'channel', 'reminders'),
  ('منبه أدعية الأنبياء', 'https://t.me/quran_hz28', NULL, 'channel', 'reminders'),
  ('منبه تاج التسبيح', 'https://t.me/quran_hz8', NULL, 'channel', 'reminders'),
  ('منبه آية الكرسي', 'https://t.me/quran_hz26', NULL, 'channel', 'reminders'),
  ('منبه أدعية الاستعاذة', 'https://t.me/Quran_hz30', NULL, 'channel', 'reminders'),
  ('منبه دعاء قرة العين', 'https://t.me/QURAN_hz31', NULL, 'channel', 'reminders'),
  ('منبه دعاء الرضا', 'https://t.me/QURAN_hz32', NULL, 'channel', 'reminders'),
  ('منبه الذكر المضاعف', 'https://t.me/QURAN_hz33', NULL, 'channel', 'reminders'),
  ('منبه دعاء المعجزات', 'https://t.me/QURAN_hz34', NULL, 'channel', 'reminders'),
  ('منبه ذي الجلال والإكرام', 'https://t.me/QURAN_hz37', NULL, 'channel', 'reminders'),
  ('نذير | راجع نفسك', 'https://t.me/nzer_hz', NULL, 'channel', 'reminders'),
  ('منبه تسبيح الملائكة', 'https://t.me/quran_hz35', NULL, 'channel', 'reminders')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- تطوير الذات (2) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('تطوير الذات', 'https://t.me/self_development_4', 'محتوى تحفيزي وتطوير ذات لتجديد الهمة', 'channel', 'selfdev'),
  ('لا تحزن فإن الله معنا', 'https://t.me/quran_h4', 'رسائل طمأنينة وتفريج للهموم', 'channel', 'selfdev')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- اقتباسات أدبية (1) ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('اقتباسات أدبية متنوعة', 'https://t.me/Oaa_hz1', 'اقتباسات أدبية وحكم متنوعة', 'channel', 'quotes')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- ملصقات دينية (5) — entity_type = sticker ---
INSERT INTO channels (name, url, description, entity_type, category)
SELECT * FROM (VALUES
  ('ملصقات دينية متنوعة', 'https://t.me/addstickers/Islami4488BoT', NULL, 'sticker', 'stickers'),
  ('ملصقات الصلاة على النبي ﷺ', 'https://t.me/addstickers/mnbh_elSlah_v2', NULL, 'sticker', 'stickers'),
  ('ملصقات تحفيزية وتطوير ذات', 'https://t.me/addstickers/quran_h4', NULL, 'sticker', 'stickers'),
  ('ملصقات القرآن الكريم', 'https://t.me/addstickers/Quran_hz', NULL, 'sticker', 'stickers'),
  ('ملصقات فواصل', 'https://t.me/addstickers/Oaa_hz1', NULL, 'sticker', 'stickers')
) AS v(name, url, description, entity_type, category)
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE channels.url = v.url);

-- --- تعليم القنوات المميّزة (Featured) — نفس منطق الموقع العام الحالي ---
UPDATE channels SET is_featured = true WHERE url IN (
'https://t.me/Quran_hz',
'https://t.me/channls_bots_hz',
'https://t.me/mnbh_elSlah',
'https://t.me/quran_hz1'
) AND (is_featured IS DISTINCT FROM true);