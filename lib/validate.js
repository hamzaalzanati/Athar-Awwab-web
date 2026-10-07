// التحقق من المدخلات التي يكتبها الأدمن ثم تُعرض للعامة (لا نثق بها)
export class ValidationError extends Error { constructor(code) { super(code); this.code = code; } }

/** رابط https أو http فقط (لا javascript: ولا data:). فارغ = null. */
export function httpUrl(v) {
  const s = String(v ?? "").trim();
  if (!s) return null;
  let u;
  try { u = new URL(s); } catch { throw new ValidationError("invalid_url"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ValidationError("invalid_url");
  return u.toString();
}

/** صورة: رابط https أو مسار داخلي (/images/x.jpg). فارغ = null. */
export function imageRef(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (s.length > 500 || /[\s"'<>\\`()\u0000-\u001f]/.test(s)) throw new ValidationError("invalid_image_url");
  if (s.startsWith("/")) {
    if (s.startsWith("//") || s.includes("..")) throw new ValidationError("invalid_image_url");
    return s;
  }
  let u;
  try { u = new URL(s); } catch { throw new ValidationError("invalid_image_url"); }
  if (u.protocol !== "https:") throw new ValidationError("invalid_image_url");
  return u.toString();
}

export function text(v, { min = 0, max = 500, code = "invalid_text" } = {}) {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  if (s.length < min || s.length > max) throw new ValidationError(code);
  return s || null;
}

export function longText(v, max = 4000) {
  const s = String(v ?? "").trim();
  if (s.length > max) throw new ValidationError("invalid_text");
  return s || null;
}

export function isoDate(v) {
  if (!v) return null;
  const t = Date.parse(v);
  if (Number.isNaN(t)) throw new ValidationError("invalid_date");
  return new Date(t).toISOString();
}

export function oneOf(v, list, code = "invalid_value") {
  if (!list.includes(v)) throw new ValidationError(code);
  return v;
}

export const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(v));
