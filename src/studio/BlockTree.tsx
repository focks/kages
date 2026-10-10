"use client";

// The block tree: the structural spine of the studio. Select (click), multi-mark
// for grouping (Cmd/Ctrl-click), and rearrange by dragging a node onto another
// (drops it just before the target, reparenting if needed). Wire dots mark
// blocks read by the selection ($block refs); a red/amber dot marks a block that
// carries a validation error/warning, so structural problems are visible without
// opening the inspector. Mutations are delegated up — the tree is presentation.

import * as React from "react";
import { resolve } from "@/engine/resolve";
import { cn } from "@/lib/utils";

export type Severity = "error" | "warning";

function Node({ doc, id, depth, selected, marked, problems, refs, onSelect, onToggleMark, onMove, drag }: {
  doc: import("@/engine/types").KageDoc; id: string; depth: number;
  selected: string; marked: Set<string>; problems: Map<string, Severity>; refs: string[];
  onSelect: (id: string) => void; onToggleMark: (id: string) => void; onMove: (dragged: string, target: string) => void;
  drag: { over: string | null; set: (id: string | null) => void };
}) {
  const b = doc.blocks[id];
  if (!b) return null;
  const r = resolve(doc.system.split("@")[0], b.type);
  const childIds = Object.values(b.slots ?? {}).flat();
  const isWired = refs.includes(id);
  const sev = problems.get(id);

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "move"; }}
        onDragOver={(e) => { e.preventDefault(); drag.set(id); }}
        onDragLeave={() => drag.over === id && drag.set(null)}
        onDrop={(e) => { e.preventDefault(); const d = e.dataTransfer.getData("text/plain"); drag.set(null); if (d && d !== id) onMove(d, id); }}
        onClick={(e) => (e.metaKey || e.ctrlKey ? onToggleMark(id) : onSelect(id))}
        style={{ paddingLeft: 8 + depth * 14 }}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-sm py-1 pr-2 text-left font-mono text-[13px] hover:bg-accent",
          id === selected && "bg-primary-soft",
          marked.has(id) && "ring-1 ring-primary ring-inset",
          drag.over === id && "bg-accent outline-dashed outline-1 outline-primary",
          isWired && "text-wire font-semibold",
        )}
      >
        {sev && <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", sev === "error" ? "bg-destructive" : "bg-warning")} />}
        {isWired && !sev && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wire" />}
        <span className="truncate">{id}</span>
        <span className="truncate text-[11px] text-muted-foreground">{r.ref ?? b.type}</span>
      </div>
      {childIds.map((cid) => (
        <Node key={cid} doc={doc} id={cid} depth={depth + 1} selected={selected} marked={marked}
          problems={problems} refs={refs} onSelect={onSelect} onToggleMark={onToggleMark} onMove={onMove} drag={drag} />
      ))}
    </div>
  );
}

export function BlockTree(props: {
  doc: import("@/engine/types").KageDoc; selected: string; marked: Set<string>;
  problems: Map<string, Severity>; refs: string[];
  onSelect: (id: string) => void; onToggleMark: (id: string) => void; onMove: (dragged: string, target: string) => void;
}) {
  const [over, setOver] = React.useState<string | null>(null);
  return <Node {...props} id={props.doc.root} depth={0} drag={{ over, set: setOver }} />;
}
