"use client";

// The library's navigation: your scopes (mine, pinned) and your projects, each
// with a live count under the *other* active filters. Plain buttons with
// aria-pressed (a toggle is not a link), so it works the same in the desktop
// rail and in the mobile filter sheet that reuses this component.

import { Folder, FolderPlus, Layers, Star, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { type Facets, type Query, type Scope } from "@/components/dashboard/library-model";

const overline = "px-2 font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

function Item({ icon: Icon, label, count, active, onClick, mono }: { icon?: LucideIcon; label: string; count?: number; active: boolean; onClick: () => void; mono?: boolean }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick}
      className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50", active && "bg-primary-soft font-medium hover:bg-primary-soft", count === 0 && !active && "text-muted-foreground")}>
      {Icon && <Icon aria-hidden className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />}
      <span className={cn("min-w-0 flex-1 truncate", mono && "font-mono text-[13px]")}>{label}</span>
      {count !== undefined && <span className="font-mono text-xs tabular-nums text-muted-foreground">{count}</span>}
    </button>
  );
}

export function FacetRail({ query, resolvedScope, facets, onChange, onNewProject, className }: {
  query: Query; resolvedScope: Exclude<Scope, "auto">; facets: Facets;
  onChange: (patch: Partial<Query>) => void; onNewProject: () => void; className?: string;
}) {
  const scopes: { id: Exclude<Scope, "auto">; label: string; icon: LucideIcon }[] = [
    { id: "mine", label: "My Kages", icon: Layers },
    { id: "pinned", label: "Pinned", icon: Star },
  ];
  return (
    <nav aria-label="Library filters" className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-0.5">
        {scopes.map((s) => <Item key={s.id} icon={s.icon} label={s.label} count={facets.scope[s.id]} active={resolvedScope === s.id} onClick={() => onChange({ scope: s.id })} />)}
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between pr-1">
          <p className={overline}>Projects</p>
          <Button size="icon-sm" variant="ghost" aria-label="New project" title="New project" onClick={onNewProject}><FolderPlus /></Button>
        </div>
        {facets.repos.length === 0 && <p className="px-2 text-xs text-muted-foreground">No projects in this view.</p>}
        {facets.repos.map((r) => <Item key={r.repo} icon={Folder} mono label={r.repo} count={r.count} active={query.repo === r.repo} onClick={() => onChange({ repo: query.repo === r.repo ? "" : r.repo })} />)}
        {query.repo && !facets.repos.some((r) => r.repo === query.repo) && <Item icon={Folder} mono label={query.repo} count={0} active onClick={() => onChange({ repo: "" })} />}
      </div>
    </nav>
  );
}
