// Two small request checks, pure so they are tested without a server: where a login may send the
// browser afterwards, and whether a state-changing request came from this app's own pages.

/** The same-origin URL to redirect to after login, or null to use `/`. Only a local path is accepted:
 *  one that starts with a single `/`. `next=@evil.test/x` makes `${origin}${next}` resolve to evil.test,
 *  and `//evil.test`, `/\evil.test` or `https://evil.test` leave the origin too, so the result is built
 *  with the URL parser and re-checked against the origin rather than trusted by its text. */
export function safeNext(next: string | null | undefined, origin: string): string {
  const fallback = new URL("/", origin).toString();
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\") || /[\u0000-\u001f\\]/.test(next)) return fallback;
  try {
    const u = new URL(next, origin);
    return u.origin === new URL(origin).origin ? u.toString() : fallback;
  } catch { return fallback; }
}

/** Is this a cross-site browser request that must not change state? Cookies ride along on a cross-site
 *  form post, so a credentialed write needs more than the cookie. Browsers state where a request came
 *  from, in `Sec-Fetch-Site` (same-origin | same-site | cross-site | none) and `Origin`; same-site is
 *  refused too, because a sibling subdomain is not this app. A request with neither header is not a
 *  browser page (the CLI, curl, an agent) and has no ambient cookies to abuse, so it passes. Safe methods
 *  are never blocked here: they must not change state, which the routes enforce separately. */
export function crossSiteWrite(req: { method: string; headers: { get(name: string): string | null }; url: string }): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method.toUpperCase())) return false;
  // A bearer token is not sent by the browser on its own, so it is not forgeable cross-site.
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return false;
  const site = req.headers.get("sec-fetch-site");
  if (site) return site !== "same-origin" && site !== "none";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (origin === "null") return true; // sandboxed iframes and data: pages
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? new URL(req.url).host;
  try { return new URL(origin).host !== host; } catch { return true; }
}
