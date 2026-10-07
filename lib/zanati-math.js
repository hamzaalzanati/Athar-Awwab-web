/** نسبة التغير؛ null عند غياب الأساس (لا معنى لنسبة من صفر). */
export function percentChange(current, previous) {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
