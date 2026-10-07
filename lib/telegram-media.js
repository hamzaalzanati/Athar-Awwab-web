/** Previews are small thumbnails (a few tens of KB); anything larger is refused to protect free-tier bandwidth. */
export const MAX_IMAGE_BYTES = 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
export class MediaError extends Error {
    code;
    constructor(code) { super(code); this.code = code; }
}
export function sniffImageType(bytes) {
    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
        return "image/jpeg";
    if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
        return "image/png";
    if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP")
        return "image/webp";
    return null;
}
export async function fetchTelegramImage(fileId, token, fetchFn, timeoutMs = 7000) {
    if (!/^[A-Za-z0-9_-]{10,250}$/.test(fileId) || !token)
        throw new MediaError("bad_request");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const meta = await fetchFn(`https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`, { signal: ctrl.signal });
        if (meta.status === 400 || meta.status === 404)
            throw new MediaError("not_found");
        if (!meta.ok)
            throw new MediaError("upstream");
        const body = await meta.json();
        const path = body?.ok ? body?.result?.file_path : null;
        if (typeof path !== "string" || path.includes(".."))
            throw new MediaError("not_found");
        if (typeof body.result.file_size === "number" && body.result.file_size > MAX_IMAGE_BYTES)
            throw new MediaError("too_large");
        const file = await fetchFn(`https://api.telegram.org/file/bot${token}/${path}`, { signal: ctrl.signal });
        if (!file.ok)
            throw new MediaError("upstream");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (bytes.length > MAX_IMAGE_BYTES)
            throw new MediaError("too_large");
        // Trust the bytes, not the header: a file served as an image must actually be one.
        const type = sniffImageType(bytes);
        if (!type || !ALLOWED.has(type))
            throw new MediaError("not_image");
        return { bytes, contentType: type };
    }
    catch (err) {
        if (err instanceof MediaError)
            throw err;
        throw new MediaError("upstream"); // never surface the original error (it may embed the token URL)
    }
    finally {
        clearTimeout(timer);
    }
}
