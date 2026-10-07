import { db } from "../lib/db.js";

const back = (res, qs) => res.status(303).setHeader("Location", `/contact?${qs}`).setHeader("Cache-Control", "no-store").end();

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  try {
    const b = req.body ?? {};
    if (String(b.website ?? "") !== "") return back(res, "sent=1"); // فخ للروبوتات: نتظاهر بالنجاح
    const message = String(b.message ?? "").trim();
    if (!message || message.length > 4000) return back(res, "error=message_required");
    // فرملة عامة ضد الإغراق (بلا تخزين عناوين IP): 30 رسالة/ساعة للموقع كله
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await db().from("contact_messages").select("id", { count: "exact", head: true }).gte("created_at", since);
    if ((count ?? 0) >= 30) return back(res, "error=rate_limited");
    const { error } = await db().from("contact_messages").insert({
      name: String(b.name ?? "").trim().slice(0, 100) || null,
      contact: String(b.contact ?? "").trim().slice(0, 200) || null,
      message,
    });
    if (error) throw new Error(error.message);
    return back(res, "sent=1");
  } catch (err) {
    console.error("contact error:", err?.message);
    return back(res, "error=failed");
  }
}
