// These pages either contain no private data or delegate access to their API.
// A shared project must reach its server-side sharing check without a login gate.
const PUBLIC = ["/login", "/auth", "/k", "/r", "/api", "/render", "/docs", "/landing"];

/** Match path segments, never prefixes: /r/<uuid> is public, /reports is not. */
export function isPublicPath(path: string): boolean {
  return PUBLIC.some(prefix => path === prefix || path.startsWith(prefix + "/"));
}
