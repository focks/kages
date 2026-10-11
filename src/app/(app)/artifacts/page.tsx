"use client";

// The Artifacts workbench: a master-detail view over the store, on shadcn.
// Master (left) lists every Kage; selecting one opens a detail pane with
// Overview / Versions / Describe tabs. Preview is a fullscreen overlay (from a
// list card or the detail), and Share sets the permission level + hands out the
// /k/<name> link. Every read and write is the one operation set over REST — the
// dashboard holds no privileged access.
// See the dashboard-over-adapters skill.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Upload, Eye, SquarePen, Download, History, Layers, FolderPlus, Folder, Copy, Archive } from "lucide-react";
import { KagePreview } from "@/components/dashboard/kage-preview";
import { ShareMenu } from "@/components/dashboard/share-menu";
import { StatusMenu } from "@/components/dashboard/status-menu";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { StateBadge, SystemChip, ValidationStatus, relTime, op, type KageCard } from "@/components/dashboard/kage-ui";
import type { KageDoc } from "@/engine/types";

interface VersionMeta {
  ref: string; v: number; state: string; createdAt: string; digest: string;
  author: { principal: string; runtime?: { framework?: string } };
  change: { summary: string; ops: number; blocksTouched: string[] };
  validation: { ok: boolean; errors: number; warnings: number };
}

function ArtifactsInner() {
  const params = useSearchParams();
  const [cards, setCards] = useState<KageCard[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [versions, setVersions] = useState<VersionMeta[]>([]);
  const [describe, setDescribe] = useState("");
  const [q, setQ] = useState("");
  const [sysFilter, setSysFilter] = useState("all");
  const [proj, setProj] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [repoInfo, setRepoInfo] = useState<{ workspace: string; projects: { repo: string; count: number }[] } | null>(null);
  const [preview, setPreview] = useState<{ doc: KageDoc; ref: string } | null>(null);

  // Preview straight from a list card — fetch the document, then open the
  // fullscreen overlay. No need to select/open the detail pane first.
  // Identify the Kage to preview by its opaque uuid, never the name/title.
  const previewByUuid = useCallback(async (uuid: string, ref: string) => {
    try { setPreview({ doc: await op<KageDoc>("get_kage", { uuid }), ref }); }
    catch (e) { toast.error(String((e as Error).message)); }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [k, r] = await Promise.all([
        op<KageCard[]>("list_kages"),
        op<{ workspace: string; projects: { repo: string; count: number }[] }>("list_repos"),
      ]);
      setCards(k); setRepoInfo(r);
    } catch (e) { toast.error(String((e as Error).message)); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  const openCard = useCallback(async (name: string) => {
    setSelected(name); setDoc(null); setVersions([]); setDescribe("");
    try {
      const [d, v, desc] = await Promise.all([
        op<KageDoc>("get_kage", { name }), op<VersionMeta[]>("list_versions", { name }), op<string>("describe_kage", { name }),
      ]);
      setDoc(d); setVersions(v); setDescribe(desc);
    } catch (e) { toast.error(String((e as Error).message)); }
  }, []);

  // Deep link: /artifacts?id=<name> opens that Kage once the list is loaded.
  useEffect(() => { const id = params.get("id"); if (id && cards && !selected) openCard(id); }, [params, cards, selected, openCard]);

  // Archived Kages are hidden by default so the workbench stays about live work;
  // the Archive toggle brings them back. The selected one always stays visible.
  const filtered = useMemo(() => (cards ?? []).filter((c) =>
    (showArchived || c.state !== "archived" || c.name === selected) &&
    (!q || (c.title + c.name).toLowerCase().includes(q.toLowerCase())) &&
    (sysFilter === "all" || c.system.startsWith(sysFilter)) &&
    (proj === "all" || c.repo === proj)), [cards, q, sysFilter, proj, showArchived, selected]);
  const archivedCount = useMemo(() => (cards ?? []).filter((c) => c.state === "archived").length, [cards]);

  // Projects (repos) in the workspace, from list_repos; include a just-created
  // empty project so it's selectable before it holds a Kage.
  const projects = useMemo(() => {
    const list = repoInfo?.projects ? [...repoInfo.projects] : [];
    if (proj !== "all" && !list.some((p) => p.repo === proj)) list.push({ repo: proj, count: 0 });
    return list.sort((a, b) => a.repo.localeCompare(b.repo));
  }, [repoInfo, proj]);

  // Group the visible cards by project for folder-like section headers.
  const groups = useMemo(() => {
    const m = new Map<string, KageCard[]>();
    for (const c of filtered) (m.get(c.repo) ?? m.set(c.repo, []).get(c.repo)!).push(c);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [filtered]);

  const current = cards?.find((c) => c.name === selected) ?? null;

  function newProject() {
    const raw = window.prompt("New project name (a–z, 0–9, -):");
    if (!raw) return;
    const slug = raw.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) return;
    setProj(slug);
    toast.message(`Project “${slug}” — import or create a Kage to populate it`);
  }

  async function exportJson(name: string) {
    const json = await op<string>("export_kage", { name, format: "json" });
    const blob = new Blob([typeof json === "string" ? json : JSON.stringify(json, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${name}.kage.json`; a.click();
  }
  async function importFile(file: File) {
    const repo = proj === "all" ? "kages" : proj; // import into the selected project
    try { await op("create_kage", { doc: JSON.parse(await file.text()), repo }); toast.success(`Imported ${file.name} into ${repo}`); await refresh(); }
    catch (e) { toast.error(`Import failed: ${(e as Error).message}`); }
  }
  async function cloneKage(name: string) {
    try {
      const r = await op<{ version?: { name: string } }>("clone_kage", { name });
      toast.success("Cloned");
      await refresh();
      if (r?.version?.name) await openCard(r.version.name);
    } catch (e) { toast.error(String((e as Error).message)); }
  }

  return (
    <div className="grid h-[calc(100svh-3.5rem)] grid-cols-1 md:grid-cols-[360px_1fr]">
      {/* Master */}
      <div className="flex min-h-0 flex-col border-r">
        {/* Workspace → the top of the organizing hierarchy */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Layers className="size-4 text-muted-foreground" />
          <span className="text-sm font-medium">{repoInfo?.workspace ?? "workspace"}</span>
          <span className="text-xs text-muted-foreground">· {projects.length} project{projects.length === 1 ? "" : "s"}</span>
        </div>
        {/* Search + project / system filters + import-into-project */}
        <div className="space-y-2 border-b p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search Kages" className="pl-8" />
          </div>
          <div className="flex items-center gap-2">
            <Select value={proj} onValueChange={(v) => (v === "__new__" ? newProject() : setProj(v ?? "all"))}>
              <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects.map((p) => <SelectItem key={p.repo} value={p.repo}>{p.repo} ({p.count})</SelectItem>)}
                <SelectItem value="__new__">＋ New project…</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sysFilter} onValueChange={(v) => setSysFilter(v ?? "all")}>
              <SelectTrigger className="w-[104px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any sys</SelectItem>
                <SelectItem value="core">Core</SelectItem>
                <SelectItem value="ledger">Ledger</SelectItem>
                <SelectItem value="atelier">Atelier</SelectItem>
              </SelectContent>
            </Select>
            <Button size="icon" variant={showArchived ? "secondary" : "outline"} aria-label="Show archived" aria-pressed={showArchived}
              title={archivedCount ? `${archivedCount} archived` : "No archived Kages"} onClick={() => setShowArchived((v) => !v)}><Archive /></Button>
            <Button size="icon" variant="outline" aria-label={`New project`} onClick={newProject}><FolderPlus /></Button>
            <Button size="icon" variant="outline" aria-label="Import JSON" nativeButton={false} render={<label />}>
              <input type="file" accept="application/json" hidden onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
              <Upload />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-3 p-3">
            {!cards && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            {cards && filtered.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                No Kages {proj === "all" ? "match" : `in “${proj}” yet`}{proj !== "all" && " — import one with the upload button."}
              </p>
            )}
            {groups.map(([repo, items]) => (
              <div key={repo} className="space-y-2">
                <div className="flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                  <Folder className="size-3.5" /><span className="font-mono">{repo}</span><span>· {items.length}</span>
                </div>
                {items.map((c) => (
                  <div key={c.name} onClick={() => openCard(c.name)} role="button" tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openCard(c.name); } }}
                    className={cn("group relative cursor-pointer rounded-xl border bg-card p-3 transition-colors hover:bg-accent", c.name === selected && "border-primary bg-primary-soft hover:bg-primary-soft")}>
                    <div className="flex items-center gap-2">
                      <span className="flex-1 truncate font-medium">{c.title}</span>
                      <StateBadge state={c.state} />
                    </div>
                    <div className="mt-1.5"><SystemChip system={c.system} /></div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{c.blocks} blocks</span><span className="font-mono">v{c.version}</span>
                      <ValidationStatus validation={c.validation} short />
                      <span className="ml-auto">{relTime(c.createdAt)}</span>
                    </div>
                    <Button size="icon" variant="outline" aria-label={`Preview ${c.title}`}
                      onClick={(e) => { e.stopPropagation(); previewByUuid(c.uuid, c.ref); }}
                      className="absolute right-2 top-2 size-7 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100">
                      <Eye className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Detail */}
      <div className="min-h-0 overflow-auto">
        {!current ? (
          <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">Select a Kage to explore its data, revisions and preview.</div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">{current.title}</h2>
              <StateBadge state={current.state} />
              <Badge variant="secondary" className="capitalize">{current.visibility}</Badge>
              <div className="ml-auto flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={!doc} onClick={() => doc && setPreview({ doc, ref: current.ref })}><Eye className="size-4" /> Preview</Button>
                <Button render={<Link href={`/studio?kage=${current.name}`} />} nativeButton={false} size="sm" variant="outline"><SquarePen className="size-4" /> Studio</Button>
                <Button size="sm" variant="outline" onClick={() => cloneKage(current.name)}><Copy className="size-4" /> Clone</Button>
                <Button size="sm" variant="outline" onClick={() => exportJson(current.name)}><Download className="size-4" /> Export</Button>
                <ShareMenu name={current.name} uuid={current.uuid} state={current.state} visibility={current.visibility}
                  onChanged={async () => { await refresh(); await openCard(current.name); }} />
                <StatusMenu name={current.name} state={current.state}
                  onChanged={async () => { await refresh(); await openCard(current.name); }}
                  onDeleted={async () => { setSelected(null); setDoc(null); setVersions([]); setDescribe(""); await refresh(); }} />
              </div>
            </div>
            <p className="mt-1 font-mono text-xs text-muted-foreground">{current.ref}</p>

            <Tabs defaultValue="overview" className="mt-5">
              <TabsList variant="line" className="w-full justify-start gap-4 border-b">
                <TabsTrigger value="overview" className="flex-none">Overview</TabsTrigger>
                <TabsTrigger value="versions" className="flex-none">Versions <span className="rounded-sm bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">{versions.length}</span></TabsTrigger>
                <TabsTrigger value="describe" className="flex-none">Describe</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-4">
                <dl className="grid max-w-xl grid-cols-[150px_1fr] gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Project</dt>
                  <dd className="inline-flex items-center gap-1.5 font-mono"><Folder className="size-3.5 text-muted-foreground" />{repoInfo?.workspace ?? "acme"} / {current.repo}</dd>
                  <dt className="text-muted-foreground">System</dt><dd><SystemChip system={current.system} /></dd>
                  <dt className="text-muted-foreground">Blocks</dt><dd>{current.blocks}</dd>
                  <dt className="text-muted-foreground">Version</dt><dd className="font-mono">v{current.version}</dd>
                  <dt className="text-muted-foreground">Visibility</dt><dd className="capitalize">{current.visibility}</dd>
                  <dt className="text-muted-foreground">Validation</dt>
                  <dd><ValidationStatus validation={current.validation} /></dd>
                  <dt className="text-muted-foreground">Last author</dt><dd className="font-mono text-xs">{current.lastAuthor}</dd>
                  <dt className="text-muted-foreground">Root block</dt><dd className="font-mono">{doc?.root ?? "…"}</dd>
                  <dt className="text-muted-foreground">Lockfile</dt><dd>{doc?.resolved ? `${Object.keys(doc.resolved.blocks).length} pinned refs` : "…"}</dd>
                </dl>
              </TabsContent>

              <TabsContent value="versions" className="mt-4">
                <div className="divide-y">
                  {[...versions].reverse().map((v) => (
                    <div key={v.v} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
                      <div className="flex items-center gap-1.5"><History className="size-4 text-muted-foreground" /><span className="font-mono font-semibold">v{v.v}</span></div>
                      <div>
                        <div className="text-sm">{v.change.summary} <span className="text-xs text-muted-foreground">· {v.change.ops} ops · {v.change.blocksTouched.length} blocks</span></div>
                        <div className="font-mono text-xs text-muted-foreground">{v.author.principal}{v.author.runtime?.framework ? ` · ${v.author.runtime.framework}` : ""} · {v.digest.slice(0, 19)}…</div>
                      </div>
                      <div className="flex items-center gap-2"><StateBadge state={v.state} /><span className="text-xs text-muted-foreground">{relTime(v.createdAt)}</span></div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="describe" className="mt-4">
                <pre className="overflow-auto rounded-xl border bg-muted p-4 font-mono text-[12.5px] leading-[18px]">{describe || "…"}</pre>
              </TabsContent>

            </Tabs>
          </div>
        )}
      </div>
      {preview && <KagePreview doc={preview.doc} kageRef={preview.ref} onClose={() => setPreview(null)} />}
    </div>
  );
}

export default function ArtifactsPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}><ArtifactsInner /></Suspense>;
}
