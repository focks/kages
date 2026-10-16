// The docs sidebar: pages grouped the way a reader looks for them (start, guides, reference, operate).
export interface NavItem { slug: string; title: string; group: string }
export interface NavGroup { group: string; items: NavItem[] }

export function docsNav(pages: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const p of pages) {
    const it = { slug: p.slug, title: p.title, group: p.group };
    const g = groups.find((x) => x.group === it.group);
    if (g) g.items.push(it); else groups.push({ group: it.group, items: [it] });
  }
  return groups;
}
