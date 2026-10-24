// Request bodies are read under a byte cap, never with a bare req.json(): Next route handlers
// and a self-hosted `next start` impose no limit of their own, so an unauthenticated multi-GB
// POST would otherwise be buffered whole into memory before any auth or validation ran.

/** Largest JSON body the operation endpoints accept. Comfortably above the stored-document cap
 *  (MAX_DOC_BYTES, 1 MB) because a document can arrive escaped inside a string (MCP arguments,
 *  import_kage), and `\uXXXX` escaping can grow it several-fold. */
export const MAX_REQUEST_BYTES = 4 * 1024 * 1024;

/** Read a request body but never more than `max` bytes. Content-Length is only a hint (a chunked
 *  upload has none), so the count is kept while streaming and the source is cancelled at the limit:
 *  an anonymous caller cannot make the server buffer more than `max` plus one chunk. */
export async function readBodyCapped(req: Request, max: number): Promise<{ text: string; tooLarge: boolean }> {
  if (!req.body) return { text: "", tooLarge: false };
  const reader = req.body.getReader(), parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) { await reader.cancel().catch(() => {}); return { text: "", tooLarge: true }; }
    parts.push(value);
  }
  return { text: Buffer.concat(parts).toString("utf8"), tooLarge: false };
}

/** Parse a JSON body read under `max`. A declared Content-Length past the cap is refused without
 *  reading. `value` is undefined for an empty or malformed body, so each caller keeps its own
 *  parse-error answer. */
export async function readJsonCapped(req: Request, max: number = MAX_REQUEST_BYTES): Promise<{ tooLarge: true } | { tooLarge: false; value: unknown }> {
  if (Number(req.headers.get("content-length") ?? 0) > max) return { tooLarge: true };
  const { text, tooLarge } = await readBodyCapped(req, max);
  if (tooLarge) return { tooLarge: true };
  try { return { tooLarge: false, value: JSON.parse(text) }; } catch { return { tooLarge: false, value: undefined }; }
}
