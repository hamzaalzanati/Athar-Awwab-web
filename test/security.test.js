import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { verifyInitData, roleAllows, ACTION_ROLE } from "../lib/auth.js";
import { httpUrl, imageRef, ValidationError, isUuid, text, oneOf } from "../lib/validate.js";

const TOKEN = "123456:TEST-TOKEN";
function sign(fields, token = TOKEN) {
  const p = new URLSearchParams(fields);
  const check = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, v]) => `${k}=${v}`).join("\n");
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  p.set("hash", crypto.createHmac("sha256", secret).update(check).digest("hex"));
  return p.toString();
}
const NOW = 1_800_000_000_000;
const fields = (over = {}) => ({ auth_date: String(NOW / 1000 - 60), query_id: "AAH", user: JSON.stringify({ id: 4242, first_name: "A" }), ...over });

test("a correctly signed, fresh initData is accepted", () => {
  const u = verifyInitData(sign(fields()), TOKEN, { now: NOW });
  assert.equal(u.id, 4242);
});
test("tampering, wrong token, missing hash and garbage are all rejected", () => {
  const good = sign(fields());
  assert.equal(verifyInitData(good.replace("4242", "1"), TOKEN, { now: NOW }), null);
  assert.equal(verifyInitData(good, "999:OTHER", { now: NOW }), null);
  assert.equal(verifyInitData(good.replace(/hash=[0-9a-f]+/, ""), TOKEN, { now: NOW }), null);
  for (const bad of ["", "x=1", null, undefined, "hash=zz", "a".repeat(5000)]) assert.equal(verifyInitData(bad, TOKEN, { now: NOW }), null);
  assert.equal(verifyInitData(sign(fields()), "", { now: NOW }), null);
});
test("stale and future-dated initData are rejected", () => {
  assert.equal(verifyInitData(sign(fields({ auth_date: String(NOW / 1000 - 90000) })), TOKEN, { now: NOW }), null);
  assert.equal(verifyInitData(sign(fields({ auth_date: String(NOW / 1000 + 4000) })), TOKEN, { now: NOW }), null);
});
test("initData without a valid user id is rejected", () => {
  assert.equal(verifyInitData(sign(fields({ user: "not json" })), TOKEN, { now: NOW }), null);
  assert.equal(verifyInitData(sign(fields({ user: JSON.stringify({ id: "1" }) })), TOKEN, { now: NOW }), null);
});
test("roles: editor < admin < owner; unknown actions and unknown roles are denied", () => {
  assert.equal(roleAllows("editor", "entity.update"), true);
  assert.equal(roleAllows("editor", "settings.set"), false);
  assert.equal(roleAllows("editor", "users.search"), false);
  assert.equal(roleAllows("admin", "settings.set"), true);
  assert.equal(roleAllows("owner", "audit.list"), true);
  assert.equal(roleAllows("hacker", "overview"), false);
  assert.equal(roleAllows("owner", "drop.everything"), false);
  assert.ok(Object.keys(ACTION_ROLE).length > 20);
});

test("validators accept only safe links", () => {
  assert.equal(httpUrl("https://t.me/x"), "https://t.me/x");
  assert.equal(httpUrl(""), null);
  for (const v of ["javascript:alert(1)", "data:text/html,x", "tg://resolve", "not a url", "ftp://x.com"]) assert.throws(() => httpUrl(v), ValidationError);
  assert.equal(imageRef("/images/a.jpg"), "/images/a.jpg");
  assert.equal(imageRef(""), null);
  for (const v of ["//evil.com/a.jpg", "/../x", "http://x.com/a.jpg", "https://x.com/a b.jpg", 'https://x.com/"a', "x".repeat(501)]) assert.throws(() => imageRef(v), ValidationError);
  assert.equal(isUuid("3f2b8c1e-1111-4222-8333-444455556666"), true);
  assert.equal(isUuid("1; drop table"), false);
  assert.throws(() => text("ab", { min: 3 }), ValidationError);
  assert.throws(() => oneOf("x", ["a"]), ValidationError);
});

test("sensitive new actions are role-gated: admins/owner-only, broadcast/jobs/users need admin, editors get content only", () => {
  for (const a of ["admins.list", "admin.upsert", "admin.toggle"]) { assert.equal(roleAllows("admin", a), false, a); assert.equal(roleAllows("owner", a), true, a); }
  for (const a of ["broadcast.send", "broadcast.preview", "jobs.list", "job.retry", "user.update", "contact.delete", "alert.ack", "import.links"]) {
    assert.equal(roleAllows("editor", a), false, a); assert.equal(roleAllows("admin", a), true, a);
  }
  for (const a of ["analytics.get", "entity.syncs", "entity.update", "preview.save"]) assert.equal(roleAllows("editor", a), true, a);
});
