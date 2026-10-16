// The docs sidebar: pages grouped the way a reader looks for them (start, guides, reference, operate),
// plus the one interactive lesson, placed right after the page that explains it so the reader meets the
// idea first and the tool second.
export const BUILD_GUIDE = { slug: "build-a-guide", title: "Build your first guide", group: "Guides" };
export interface NavItem { slug: string; title: string; group: string }
export interface NavGroup { group: string; items: NavItem[] }

export function docsNav(pages: NavItem[]): NavGroup[] {
  const items = pages.map((p) => ({ slug: p.slug, title: p.title, group: p.group }));
  const at = items.findIndex((n) => n.slug === "decision-guides");
  items.splice(at < 0 ? items.length : at + 1, 0, BUILD_GUIDE);
  const groups: NavGroup[] = [];
  for (const it of items) {
    const g = groups.find((x) => x.group === it.group);
    if (g) g.items.push(it); else groups.push({ group: it.group, items: [it] });
  }
  return groups;
}
