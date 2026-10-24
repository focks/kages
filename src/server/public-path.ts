// These pages either contain no private data or delegate access to their API.
// A shared project must reach its server-side sharing check without a login gate.
const PUBLIC = ["/gallery", "/onboarding", "/login", "/auth", "/k", "/r", "/embed", "/api", "/render", "/docs", "/landing"];

/** Match path segments, never prefixes: /r/<uuid> is public, /reports is not. */
export function isPublicPath(path: string): boolean {
  if (/^\/downloads\/ifocksh-kages-\d+\.\d+\.\d+\.tgz$/.test(path)) return true;
  return PUBLIC.some(prefix => path === prefix || path.startsWith(prefix + "/"));
}
