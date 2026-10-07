import { createClient } from "@supabase/supabase-js";

let client;
/** مفتاح service_role يبقى على الخادم فقط (متغيرات Vercel) ولا يصل للمتصفح أبدًا. */
export function db() {
  if (!client) {
    const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set");
    client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return client;
}
export function must({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}
