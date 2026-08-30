/* api/_lib/telegram.js — نداءات Telegram Bot API مباشرة (fetch بسيط)
   مفيش داعي لمكتبة grammY هنا: الداشبورد مش بيستقبل تحديثات من تليجرام
   (ده شغل البوت المستضاف بشكل منفصل)، هي بس بتبعت أوامر — يعني نفس
   BOT_TOKEN لكن بدون الحاجة لتشغيل عملية بوت كاملة جنب الموقع. */

const BOT_TOKEN = process.env.BOT_TOKEN;
const API = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function tg(method, payload) {
  const res = await fetch(`${API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return res.json();
}

module.exports = { tg, BOT_TOKEN };
