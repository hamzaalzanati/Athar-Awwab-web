import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchTelegramImage, sniffImageType, MediaError } from "../lib/telegram-media.js";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
const TOKEN = "123456:SECRET-TOKEN";
const FILE_ID = "AgACAgQAAxkBAAIBcGabc_123456";
function mockFetch(handlers) {
    const calls = [];
    const fn = async (url) => {
        calls.push(url);
        const isMeta = url.includes("/getFile");
        if (handlers.throwOn === (isMeta ? "meta" : "file"))
            throw new Error(`network down at ${url}`);
        if (isMeta) {
            const status = handlers.metaStatus ?? 200;
            return { ok: status < 400, status, headers: { get: () => null }, json: async () => handlers.meta ?? { ok: true, result: { file_path: "photos/file_1.jpg", file_size: 100 } }, arrayBuffer: async () => new ArrayBuffer(0) };
        }
        const status = handlers.fileStatus ?? 200;
        const data = handlers.file ?? JPEG;
        return { ok: status < 400, status, headers: { get: () => "application/octet-stream" }, json: async () => ({}), arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) };
    };
    return { fn, calls };
}
test("happy path returns bytes with a sniffed content type (header ignored)", async () => {
    const { fn, calls } = mockFetch({});
    const r = await fetchTelegramImage(FILE_ID, TOKEN, fn);
    assert.equal(r.contentType, "image/jpeg");
    assert.equal(r.bytes.length, JPEG.length);
    assert.equal(calls.length, 2);
});
test("non-image bytes are refused even if Telegram says otherwise", async () => {
    const html = new TextEncoder().encode("<html><script>alert(1)</script></html>");
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ file: html }).fn), (e) => e.code === "not_image");
});
test("bad file ids never reach the network", async () => {
    const { fn, calls } = mockFetch({});
    for (const bad of ["", "short", "has space in it12345", "../../etc/passwd", "a".repeat(300)]) {
        await assert.rejects(fetchTelegramImage(bad, TOKEN, fn), (e) => e.code === "bad_request");
    }
    assert.equal(calls.length, 0);
});
test("path traversal in file_path is refused", async () => {
    const { fn } = mockFetch({ meta: { ok: true, result: { file_path: "../../secret" } } });
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, fn), (e) => e.code === "not_found");
});
test("oversize files are refused from metadata and from the bytes", async () => {
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ meta: { ok: true, result: { file_path: "p.jpg", file_size: 2_000_000 } } }).fn), (e) => e.code === "too_large");
    const big = new Uint8Array(1024 * 1024 + 1);
    big.set([0xff, 0xd8, 0xff]);
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ file: big }).fn), (e) => e.code === "too_large");
});
test("unknown file id -> not_found; upstream failure -> upstream", async () => {
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ metaStatus: 400 }).fn), (e) => e.code === "not_found");
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ metaStatus: 500 }).fn), (e) => e.code === "upstream");
    await assert.rejects(fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ fileStatus: 500 }).fn), (e) => e.code === "upstream");
});
test("the bot token never leaks through errors", async () => {
    for (const throwOn of ["meta", "file"]) {
        try {
            await fetchTelegramImage(FILE_ID, TOKEN, mockFetch({ throwOn }).fn);
            assert.fail("should throw");
        }
        catch (e) {
            assert.ok(e instanceof MediaError);
            assert.equal(e.code, "upstream");
            assert.ok(!String(e.message).includes("SECRET-TOKEN") && !String(e.stack).includes("SECRET-TOKEN"));
        }
    }
});
test("magic-byte sniffing", () => {
    assert.equal(sniffImageType(JPEG), "image/jpeg");
    assert.equal(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0])), "image/png");
    assert.equal(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBP")), "image/webp");
    assert.equal(sniffImageType(new TextEncoder().encode("GIF89a.....")), null);
    assert.equal(sniffImageType(new Uint8Array([])), null);
});
