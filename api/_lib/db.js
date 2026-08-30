/* api/_lib/db.js — وحدة مشتركة للتعامل مع Supabase (نفس منطق الملفات التانية) */
const SUPABASE_URL = process.env.SUPABASE_URL || null;
const SUPABASE_KEY = process.env.SUPABASE_KEY || null;

async function db(table, { method = "GET", query = "", body = null } = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return { error: "no_db" };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
        Prefer: method === "POST" ? "return=representation" : "return=minimal"
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) return { error: await res.text() };
    return { data: await res.json().catch(() => null) };
  } catch (e) {
    return { error: String(e) };
  }
}

module.exports = { db };
