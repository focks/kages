"use client";

// The studio: edit a Kage's blocks through their contracts, not free-form. The
// props panel is generated from the selected block's contract (you can only set
// what the contract declares), edits go through JSON Patch, and selecting a
// block highlights the blocks it reads via $block (the "wire" references). A
// live preview renders the result with @kages/runtime.
// See oracle/contracts.feature.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolve } from "@/engine/resolve";
import { walkExpr } from "@/engine/expr";
import { applyPatch, type PatchOp } from "@/collab/patch";
import { KageRenderer } from "@/runtime/KageRenderer";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { KageFrame } from "@/components/dashboard/kage-ui";
import { cn } from "@/lib/utils";
import type { KageDoc, PropSpec } from "@/engine/types";

// Teal means connection: the wire reference colour. A chrome token, never a
// Tailwind palette value.
const WIRE = "text-wire";

function refsOf(doc: KageDoc, id: string): string[] {
  const b = doc.blocks[id];
  const out = new Set<string>();
  walkExpr([b?.props, b?.bind, b?.visible], (op, arg) => { if (op === "$block") out.add(String(arg).split(".")[0]); });
  return [...out];
}

function TreeNode({ doc, id, depth, selected, refs, onSelect }: {
  doc: KageDoc; id: string; depth: number; selected: string; refs: string[]; onSelect: (id: string) => void;
}) {
  const b = doc.blocks[id];
  if (!b) return null;
  const r = resolve(doc.system.split("@")[0], b.type);
  const childIds = Object.values(b.slots ?? {}).flat();
  const isWired = refs.includes(id);
  return (
    <div>
      <button onClick={() => onSelect(id)} style={{ paddingLeft: 8 + depth * 14 }}
        className={cn("flex w-full items-center gap-2 rounded-sm py-1 pr-2 text-left font-mono text-[13px] hover:bg-accent",
          id === selected && "bg-primary-soft", isWired && cn(WIRE, "font-semibold"))}>
        {isWired && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wire" />}
        <span>{id}</span>
        <span className="truncate text-[11px] text-muted-foreground">{r.ref ?? b.type}</span>
      </button>
      {childIds.map((cid) => <TreeNode key={cid} doc={doc} id={cid} depth={depth + 1} selected={selected} refs={refs} onSelect={onSelect} />)}
    </div>
  );
}

function PropsPanel({ doc, id, onPatch }: { doc: KageDoc; id: string; onPatch: (ops: PatchOp[]) => void }) {
  const b = doc.blocks[id];
  const r = resolve(doc.system.split("@")[0], b.type);
  if (!r.contract) return <p className="text-sm text-destructive">Unresolved: {r.error}</p>;
  const c = r.contract;
  const bound = new Set(Object.keys(b.bind ?? {}));

  function setProp(key: string, raw: string, spec: PropSpec) {
    let value: unknown = raw;
    if (spec.type === "number") value = raw === "" ? 0 : Number(raw);
    if (spec.type === "boolean") value = raw === "true";
    const exists = (b.props ?? {})[key] !== undefined;
    onPatch([{ op: exists ? "replace" : "add", path: `/blocks/${id}/props/${key}`, value: value as never }]);
  }

  return (
    <div>
      <h3 className="font-mono text-sm font-semibold">{id}</h3>
      <p className="mb-3 text-xs text-muted-foreground"><span className="font-mono">{c.ref}</span> · {c.summary}</p>
      <div className="space-y-3">
        {Object.entries(c.props).map(([key, spec]) => {
          const val = (b.props ?? {})[key];
          const isBound = bound.has(key);
          const editable = !isBound && ["string", "number", "boolean"].includes(spec.type ?? "") && !spec.enum;
          return (
            // Key by block id too: switching blocks remounts the fields, so an
            // uncontrolled Input never shows the previous block's value.
            <div key={`${id}:${key}`} className="space-y-1">
              <label className="font-mono text-xs text-muted-foreground">{key}{spec.required ? " *" : ""} <span className="italic opacity-70">{spec.type}</span></label>
              {isBound ? (
                <div className="inline-flex items-center gap-1.5 rounded-sm bg-wire-soft px-2 py-1 font-mono text-xs text-wire">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wire" />
                  {JSON.stringify(b.bind![key])}
                </div>
              ) : spec.enum ? (
                // Controlled: the value lives in the doc, so editing (or switching
                // blocks) flows value → doc → value with no uncontrolled warning.
                <Select value={val === undefined ? null : String(val)} onValueChange={(v) => setProp(key, v ?? "", spec)}>
                  <SelectTrigger className="h-8"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>{spec.enum.map((o) => <SelectItem key={String(o)} value={String(o)}>{String(o)}</SelectItem>)}</SelectContent>
                </Select>
              ) : editable ? (
                <Input defaultValue={val === undefined ? "" : String(val)} onBlur={(e) => setProp(key, e.target.value, spec)} className="h-8" />
              ) : (
                <div className="whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{val === undefined ? "—" : JSON.stringify(val)}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StudioInner() {
  const params = useSearchParams();
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [selected, setSelected] = useState("");

  useEffect(() => {
    const name = params.get("kage");
    const url = name ? `/api/get_kage?name=${encodeURIComponent(name)}` : "/ds/ops-console.kage.json";
    fetch(url).then((r) => r.json()).then((d: KageDoc) => { setDoc(d); setSelected(d.root); });
  }, [params]);

  const refs = useMemo(() => (doc && selected ? refsOf(doc, selected) : []), [doc, selected]);
  if (!doc) return <div className="p-6"><Skeleton className="h-96 w-full" /></div>;

  const patch = (ops: PatchOp[]) => { try { setDoc(applyPatch(doc, ops)); } catch (e) { console.error(e); } };

  return (
    <div className="grid h-[calc(100svh-3.5rem)] grid-cols-[240px_280px_1fr]">
      <div className="flex min-h-0 flex-col border-r">
        <div className="flex items-center gap-2 border-b px-3 py-2 font-mono text-[11px] leading-[14px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          Block tree
          <span className="inline-flex items-center gap-1 normal-case text-wire"><span aria-hidden className="size-1.5 rounded-full bg-wire" />read by selection</span>
        </div>
        <ScrollArea className="flex-1"><div className="p-2"><TreeNode doc={doc} id={doc.root} depth={0} selected={selected} refs={refs} onSelect={setSelected} /></div></ScrollArea>
      </div>
      <div className="min-h-0 border-r"><ScrollArea className="h-full"><div className="p-4">{selected && <PropsPanel doc={doc} id={selected} onPatch={patch} />}</div></ScrollArea></div>
      <div className="min-h-0 overflow-auto p-4">
        <KageFrame system={doc.system} kageRef={`kages://acme/kages/${doc.id}`}>
          <KageRenderer doc={doc} />
        </KageFrame>
      </div>
    </div>
  );
}

export default function StudioPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}><StudioInner /></Suspense>;
}
