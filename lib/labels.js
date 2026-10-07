export const TYPE_LABEL = {
    channel: "قناة", bot: "بوت", group: "جروب", sticker_pack: "ملصقات",
};
export const TYPE_PATH = {
    channel: "channels", bot: "bots", group: "groups", sticker_pack: "stickers",
};
export const TYPE_PLURAL = {
    channel: "القنوات", bot: "البوتات", group: "الجروبات", sticker_pack: "الملصقات الدينية",
};
export const JOIN_LABEL = {
    channel: "انضم إلى تيليجرام", bot: "افتح البوت في تيليجرام", group: "انضم إلى تيليجرام", sticker_pack: "أضف الملصقات في تيليجرام",
};
export const RELATIONSHIP_LABEL = {
    own: "من مشروعنا", contribution: "مساهمة في مشروع", supported: "مشروع مدعوم",
};
/** Counts under 100 are never shown publicly (they still count in aggregates). */
export function publicCount(count, hidden) {
    if (count == null || count < 100 || hidden)
        return null;
    return count.toLocaleString("en-US");
}
/** Deterministic 32-bit hash: same name => same generated artwork. */
export function hashString(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
export function formatTime(iso) {
    if (!iso)
        return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return null;
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}
