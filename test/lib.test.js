import { test } from "node:test";
import assert from "node:assert/strict";
import { projectAgeYears, yearsPhrase } from "../lib/project-age.js";
import { publicCount, hashString, formatTime } from "../lib/labels.js";
test("project age is computed from the year, not hardcoded", () => {
    assert.equal(projectAgeYears(new Date("2026-09-29T00:00:00Z")), 5);
    assert.equal(projectAgeYears(new Date("2031-01-01T00:00:00Z")), 10);
    assert.equal(projectAgeYears(new Date("2020-01-01T00:00:00Z")), 0);
});
test("Arabic year agreement uses Western digits", () => {
    assert.equal(yearsPhrase(1), "سنة");
    assert.equal(yearsPhrase(2), "سنتان");
    assert.equal(yearsPhrase(5), "5 سنوات");
    assert.equal(yearsPhrase(12), "12 سنة");
    assert.doesNotMatch(yearsPhrase(7), /[\u0660-\u0669]/);
});
test("public counts: hidden under 100 or when flagged, Western digits", () => {
    assert.equal(publicCount(99), null);
    assert.equal(publicCount(null), null);
    assert.equal(publicCount(5000, true), null);
    assert.equal(publicCount(12345), "12,345");
});
test("hash is deterministic", () => {
    assert.equal(hashString("قناة"), hashString("قناة"));
    assert.notEqual(hashString("a"), hashString("b"));
});
test("time formatting is Western digits and tolerant", () => {
    assert.equal(formatTime(null), null);
    assert.equal(formatTime("garbage"), null);
    assert.match(formatTime("2026-01-01T10:05:00Z"), /^\d{2}:\d{2}$/);
});
