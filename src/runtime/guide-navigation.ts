// Only the declared root guide may claim the host URL fragment. Embedded cards
// never opt in; a frame message cannot navigate a URL or invent a route.
import type { KageDoc } from "../engine/types.ts";

/** Return bounded, unique chapter slugs for a root guide with static navigation. */
export function guideRoutes(doc: KageDoc): string[] {
  const root = doc.blocks[doc.root];
  if (!root || !/^(?:[a-z][a-z0-9-]*\/)?guide(?:@[0-9.]+)?$/.test(root.type)) return [];
  const chapters = root.props?.chapters;
  if (!Array.isArray(chapters)) return [];
  return [...new Set(chapters.flatMap(c => c && typeof c === "object" && "id" in c && typeof c.id === "string" && /^[a-z][a-z0-9-]{0,47}$/.test(c.id) ? [c.id] : []))].slice(0, 40);
}

/** Empty fragment means the first chapter; unknown/anchor fragments leave state alone. */
export function chapterFromHash(hash: string, routes: string[]): string | undefined {
  if (!hash || hash === "#") return routes[0];
  const slug = hash.slice(1);
  return routes.includes(slug) ? slug : undefined;
}
