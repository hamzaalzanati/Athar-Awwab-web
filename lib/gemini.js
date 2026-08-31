/* lib/gemini.js — نفس منطق البوت، لكن هنا للوحة التحكم (الموقع)
   محتاج GEMINI_API_KEY في إعدادات Vercel (نفس المفتاح المستخدم في
   مشروع البوت، أو مفتاح تاني لو حابب تفصلهم). */
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || null;

async function askGemini(userText, systemInstruction) {
  if (!GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userText }] }],
          systemInstruction: { parts: [{ text: systemInstruction }] }
        })
      }
    );
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    return null;
  }
}

module.exports = { askGemini, hasGemini: () => !!GEMINI_API_KEY };
