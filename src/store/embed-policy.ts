// Embedding is an owner-published, exact-origin policy. No wildcard, credentials,
// path or header syntax from document data may become a CSP directive.
export function embedOrigins(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error("Choose up to 20 exact embed origins.");
  const origins = value.map(value => {
    if (typeof value !== "string" || value.length > 300) throw new Error("Each embed origin must be an HTTPS origin.");
    let url: URL;
    try { url = new URL(value); } catch { throw new Error("Invalid embed origin."); }
    const local = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash || url.pathname !== "/" || url.origin !== value.replace(/\/$/, "")) throw new Error("Use exact HTTPS origins without paths, credentials or wildcards.");
    if (url.hostname.includes("*")) throw new Error("Wildcard embed origins are not supported.");
    return url.origin;
  });
  return [...new Set(origins)];
}

/** An absent or invalid policy denies third-party embedding rather than widening it. */
export function publishedEmbedOrigins(meta: unknown): string[] {
  if (!meta || typeof meta !== "object") return [];
  try { return embedOrigins((meta as Record<string, unknown>).embedOrigins); } catch { return []; }
}

/** CSP, not Referer, enforces the complete ancestor chain even when referrers are omitted. */
export function embedCsp(origins: string[], scriptHash: string, assetHashes: string[], origin: string): string {
  if (!/^sha256-[A-Za-z0-9+/]+={0,2}$/.test(scriptHash)) throw new Error("Invalid embed script hash");
  if (!assetHashes.every(hash => /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(hash))) throw new Error("Invalid embed asset hashes");
  const base = new URL(origin).origin;
  const safe = embedOrigins(origins);
  return `default-src 'none'; script-src ${[scriptHash, ...assetHashes].map(hash => `'${hash}'`).join(" ")}; frame-src 'self'; style-src ${base} https://fonts.googleapis.com 'unsafe-inline'; font-src ${base} https://fonts.gstatic.com data:; img-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'${safe.length ? " " + safe.join(" ") : ""}`;
}
