-- =========================================================
-- Migration 004: internal_note + site_settings (Emergency Mode / contact email)
-- =========================================================

-- عمود ملاحظة داخلية على رسائل التواصل (تُستخدم في دورة حياة الرسالة:
-- جديدة → مقروءة → قيد المعالجة → محلولة/مؤرشفة)
ALTER TABLE contact_messages
  ADD COLUMN IF NOT EXISTS internal_note text;

-- إعدادات المشروع كـ key/value حقيقي بدل ما تفضل متغيرات بيئة بس
-- (البريد الإلكتروني للتواصل ما يظهرش في الموقع العام إلا لو الأدمن
-- ضافه هنا فعليًا — لا Email وهمي أبدًا، مطابقة لـ §37).
CREATE TABLE IF NOT EXISTS site_settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- وضع الطوارئ (Emergency Kill Switch) — يوقف النشر الجماعي فورًا
-- بدون ما يوقف الموقع العام. §50/§80 في المواصفات.
INSERT INTO site_settings (key, value)
VALUES ('emergency_mode', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;
