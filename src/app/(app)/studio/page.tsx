"use client";

// The studio: full visual + JSON authoring over a Kage, every edit flowing
// through the pure doc-ops layer (src/studio/doc-ops.ts) and validated live.
//   • Tree (left) — structure: select, multi-mark (Cmd-click) to group, drag to
//     move, plus a toolbar to add/duplicate/delete/group and nudge blocks.
//   • Inspector/JSON (middle) — edit props, bindings and actions by contract, or
//     the raw document; both write the same `doc`.
//   • Preview (right) — the live render.
//   • Problems (bottom) — validation findings that point at the exact field.
// Persistence is Save → patch_kage (the one operation set; the page never
// imports the store). See the plan and oracle/contracts.feature.

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Copy, Trash2, Combine, ArrowUp, ArrowDown, IndentIncrease, IndentDecrease, Save } from "lucide-react";
import { resolve } from "@/engine/resolve";
import { walkExpr } from "@/engine/expr";
import { validate } from "@/engine/validate";
import { applyPatch, type PatchOp } from "@/collab/patch";
import { KageRenderer } from "@/runtime/KageRenderer";
import { KageFrame, op } from "@/components/dashboard/kage-ui";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { KageDoc, Finding } from "@/engine/types";
import { addBlock, duplicateBlock, deleteBlock, moveBlock, groupBlocks, docDiff, parentOf } from "@/studio/doc-ops";
import { BlockTree, type Severity } from "@/studio/BlockTree";
import { AddBlockMenu } from "@/studio/AddBlockMenu";
import { Inspector } from "@/studio/Inspector";
import { JsonEditor } from "@/studio/JsonEditor";
import { ProblemsBar } from "@/studio/ProblemsBar";
import { pointerToField } from "@/studio/problems";

function refsOf(doc: KageDoc, id: string): string[] {
  const b = doc.blocks[id];
  const out = new Set<string>();
  walkExpr([b?.props, b?.bind, b?.visible], (opName, arg) => { if (opName === "$block") out.add(String(arg).split(".")[0]); });
  return [...out];
}

function slotsOfType(sysId: string, type: string): string[] {
  const c = resolve(sysId, type).contract;
  return c ? Object.keys(c.slots || {}) : [];
}

function StudioInner() {
  const params = useSearchParams();
  const name = params.get("kage");
  const [head, setHead] = useState<KageDoc | null>(null);
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [selected, setSelected] = useState("");
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [mid, setMid] = useState("inspector");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d: KageDoc = name ? await op<KageDoc>("get_kage", { name }) : await fetch("/ds/ops-console.kage.json").then((r) => r.json());
      setHead(d); setDoc(d); setSelected(d.root); setMarked(new Set());
    } catch (e) { toast.error(String((e as Error).message)); }
  }, [name]);
  useEffect(() => { load(); }, [load]);

  const sysId = doc ? doc.system.split("@")[0] : "core";
  const validation = useMemo(() => (doc ? validate(doc) : null), [doc]);
  const problems = useMemo(() => {
    const m = new Map<string, Severity>();
    if (validation) {
      for (const f of validation.warnings) { const id = pointerToField(f.at).blockId; if (id) m.set(id, "warning"); }
      for (const f of validation.errors) { const id = pointerToField(f.at).blockId; if (id) m.set(id, "error"); } // error wins
    }
    return m;
  }, [validation]);
  const refs = useMemo(() => (doc && selected ? refsOf(doc, selected) : []), [doc, selected]);
  const dirty = useMemo(() => (head && doc ? docDiff(head, doc).length > 0 : false), [head, doc]);
  const blockFindings = useMemo(
    () => (validation && selected ? [...validation.errors, ...validation.warnings].filter((f) => pointerToField(f.at).blockId === selected) : []) as Finding[],
    [validation, selected],
  );

  if (!doc) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  // A structural edit may throw (e.g. deleting the root) — surface it, don't crash.
  const edit = (fn: () => KageDoc) => { try { setDoc(fn()); } catch (e) { toast.error(String((e as Error).message)); } };
  const patch = (ops: PatchOp[]) => edit(() => applyPatch(doc, ops));

  // Where "Add" targets: into the selected block if it's a container, else into
  // the selected block's parent (add a sibling).
  const selSlots = slotsOfType(sysId, doc.blocks[selected]?.type ?? "");
  const addParent = selSlots.length ? selected : parentOf(doc, selected)?.parentId;
  const addSlots = selSlots.length ? selSlots : addParent ? slotsOfType(sysId, doc.blocks[addParent].type) : [];

  const loc = parentOf(doc, selected);
  const slotLen = loc ? doc.blocks[loc.parentId].slots![loc.slot].length : 0;
  const prevSib = loc && loc.index > 0 ? doc.blocks[loc.parentId].slots![loc.slot][loc.index - 1] : null;
  const prevContainerSlots = prevSib ? slotsOfType(sysId, doc.blocks[prevSib].type) : [];
  const grandparent = loc ? parentOf(doc, loc.parentId) : null;

  function del() {
    if (selected === doc!.root) { toast.error("cannot delete the root block"); return; }
    const parent = parentOf(doc!, selected)?.parentId ?? doc!.root;
    edit(() => deleteBlock(doc!, selected));
    setSelected(parent);
  }
  function group() {
    const ids = [...marked];
    try {
      const next = groupBlocks(doc!, ids);
      const gid = Object.keys(next.blocks).find((k) => !(k in doc!.blocks));
      setDoc(next); setMarked(new Set()); if (gid) setSelected(gid);
    } catch (e) { toast.error(String((e as Error).message)); }
  }
  function onMoveDnD(dragged: string, target: string) {
    const t = parentOf(doc!, target);
    if (!t) return;
    // Drop just before the target in its slot; account for same-slot shift.
    const from = parentOf(doc!, dragged);
    const idx = from && from.parentId === t.parentId && from.slot === t.slot && from.index < t.index ? t.index - 1 : t.index;
    edit(() => moveBlock(doc!, dragged, t.parentId, t.slot, idx));
  }

  async function save() {
    if (!name || !head) return;
    setSaving(true);
    try {
      const ops = docDiff(head, doc!);
      await op("patch_kage", { name, ops });
      toast.success("Saved");
      await load();
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setSaving(false); }
  }

  const toggleMark = (id: string) => setMarked((m) => { const n = new Set(m); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const canSave = !!name && dirty && !!validation?.ok && !saving;

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      {/* Sub-header */}
      <div className="flex items-center gap-3 border-b px-4 py-2">
        <h2 className="font-display text-[17px] font-[650] tracking-[-0.01em]">{doc.title}</h2>
        <span className="font-mono text-xs text-muted-foreground">{doc.system}</span>
        <div className="ml-auto flex items-center gap-3">
          {dirty && <span className="text-xs text-muted-foreground">● unsaved</span>}
          <span className={cn("text-xs", validation?.ok ? "text-success" : "text-destructive")}>
            {validation?.ok ? "valid" : `${validation?.errors.length} error${validation?.errors.length === 1 ? "" : "s"}`}
          </span>
          {name ? (
            <Button size="sm" onClick={save} disabled={!canSave}><Save className="size-4" /> Save</Button>
          ) : (
            <span className="text-xs text-muted-foreground">read-only (open from Artifacts to save)</span>
          )}
        </div>
      </div>

      {/* Main */}
      <div className="grid min-h-0 flex-1 grid-cols-[260px_340px_1fr]">
        {/* Tree + toolbar */}
        <div className="flex min-h-0 flex-col border-r">
          <div className="flex flex-wrap items-center gap-1 border-b p-2">
            {addParent && <AddBlockMenu sysId={sysId} slots={addSlots} onAdd={(type, slot) => edit(() => addBlock(doc, addParent, slot, type))} />}
            <Button size="icon" variant="outline" className="size-8" aria-label="Duplicate" disabled={selected === doc.root} onClick={() => edit(() => duplicateBlock(doc, selected))}><Copy className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Delete" disabled={selected === doc.root} onClick={del}><Trash2 className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Group marked" disabled={marked.size < 2} onClick={group}><Combine className="size-4" /></Button>
            <span className="mx-1 h-5 w-px bg-border" />
            <Button size="icon" variant="outline" className="size-8" aria-label="Move up" disabled={!loc || loc.index === 0} onClick={() => loc && edit(() => moveBlock(doc, selected, loc.parentId, loc.slot, loc.index - 1))}><ArrowUp className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Move down" disabled={!loc || loc.index >= slotLen - 1} onClick={() => loc && edit(() => moveBlock(doc, selected, loc.parentId, loc.slot, loc.index + 1))}><ArrowDown className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Nest into previous" disabled={!prevContainerSlots.length} onClick={() => prevSib && edit(() => { const s = prevContainerSlots.includes("children") ? "children" : prevContainerSlots[0]; return moveBlock(doc, selected, prevSib, s, (doc.blocks[prevSib].slots?.[s]?.length ?? 0)); })}><IndentIncrease className="size-4" /></Button>
            <Button size="icon" variant="outline" className="size-8" aria-label="Move out" disabled={!grandparent} onClick={() => loc && grandparent && edit(() => moveBlock(doc, selected, grandparent.parentId, grandparent.slot, grandparent.index + 1))}><IndentDecrease className="size-4" /></Button>
          </div>
          <div className="border-b px-3 py-1.5 font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
            Block tree <span className="normal-case">· Cmd-click to mark · drag to move</span>
          </div>
          <ScrollArea className="flex-1"><div className="p-2">
            <BlockTree doc={doc} selected={selected} marked={marked} problems={problems} refs={refs} onSelect={setSelected} onToggleMark={toggleMark} onMove={onMoveDnD} />
          </div></ScrollArea>
        </div>

        {/* Inspector / JSON */}
        <div className="flex min-h-0 flex-col border-r">
          <Tabs value={mid} onValueChange={setMid} className="flex min-h-0 flex-1 flex-col">
            <TabsList variant="line" className="shrink-0 justify-start gap-4 border-b px-3">
              <TabsTrigger value="inspector" className="flex-none">Inspector</TabsTrigger>
              <TabsTrigger value="json" className="flex-none">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="inspector" className="min-h-0 flex-1">
              <ScrollArea className="h-full"><div className="p-4">{selected && <Inspector doc={doc} id={selected} onPatch={patch} findings={blockFindings} />}</div></ScrollArea>
            </TabsContent>
            <TabsContent value="json" className="min-h-0 flex-1 p-3">
              <JsonEditor doc={doc} onChange={setDoc} />
            </TabsContent>
          </Tabs>
        </div>

        {/* Preview */}
        <div className="min-h-0 overflow-auto p-4">
          <KageFrame system={doc.system} kageRef={`kages://acme/kages/${doc.id}`}>
            <KageRenderer doc={doc} />
          </KageFrame>
        </div>
      </div>

      {/* Problems */}
      <ProblemsBar errors={validation?.errors ?? []} warnings={validation?.warnings ?? []}
        onPick={(f) => { const id = pointerToField(f.at).blockId; if (id && doc.blocks[id]) setSelected(id); setMid("inspector"); }} />
    </div>
  );
}

export default function StudioPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}><StudioInner /></Suspense>;
}
