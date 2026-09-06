-- =========================================================
-- Migration 003: Preview Snapshots (حقيقي، Admin-curated)
-- =========================================================
-- ليه محتاجين الميجريشن ده؟
-- المعاينة اللي شغالة دلوقتي في /api/posts.js بتقرا من جدول
-- channel_posts اللي بيتملى تلقائيًا من البوت مع كل منشور جديد،
-- وده بالظبط اللي مفروض ميحصلش حسب مواصفات المشروع:
--   "لا تحدث Preview تلقائيًا عند نشر Telegram Post جديد"
--   "Preview = Static Snapshot يختاره الأدمن يدويًا، مش أرشيف حي"
-- فبنضيف جدول previews منفصل: الأدمن هو اللي يكتب/يحدّث المعاينة
-- من لوحة التحكم، ومفيش تحديث تلقائي مربوط بمنشورات تليجرام حقيقية.
--
-- جدول channel_posts نفسه *مش بنحذفه* (ممكن يتفيد بيه لاحقًا كمصدر
-- "اقتراح نص جاهز" للأدمن وقت ما البوت يشتغل)، بس الموقع العام
-- بقى بيقرا من previews بس.
-- =========================================================

CREATE TABLE IF NOT EXISTS previews (
  id           bigserial PRIMARY KEY,
  channel_id   bigint NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
  text         text,
  media_type   text CHECK (media_type IN ('text','photo')) DEFAULT 'text',
  image_url    text,
  original_link text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  updated_by   text
);

CREATE INDEX IF NOT EXISTS idx_previews_channel_id ON previews (channel_id);
