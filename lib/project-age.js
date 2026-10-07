/** Project age is computed, never hardcoded ("5 years" would go stale). */
export const PROJECT_START_YEAR = 2021;
export function projectAgeYears(now = new Date()) {
    return Math.max(0, now.getUTCFullYear() - PROJECT_START_YEAR);
}
/** Arabic number-noun agreement for "years", Western digits. */
export function yearsPhrase(n) {
    if (n === 1)
        return "سنة";
    if (n === 2)
        return "سنتان";
    if (n >= 3 && n <= 10)
        return `${n} سنوات`;
    return `${n} سنة`;
}
