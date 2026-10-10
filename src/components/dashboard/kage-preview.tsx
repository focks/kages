"use client";

// Fullscreen Kage preview — the former /viewer route, now an overlay so a Kage
// can be previewed in place from the artifacts list or detail without leaving
// the workbench. A chrome bar (title, ref, live design-system switch, close X)
// sits over a full-bleed KageRenderer; everything below the bar is painted by
// the Kage's own system, so the bar carries chrome tokens and the body carries
// none. Esc or the X closes it. The same portable document renders in core,
// ledger or atelier with one field changed — System Swap, made visible.

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SystemChip } from "./kage-ui";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";

const SYSTEMS = ["core", "ledger", "atelier"] as const;

export function KagePreview({ doc, kageRef, onClose }: { doc: KageDoc; kageRef: string; onClose: () => void }) {
  const [system, setSystem] = useState<string>(() => doc.system.split("@")[0] || "core");

  // Esc closes — the keyboard affordance a fullscreen overlay owes the user.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" role="dialog" aria-modal="true" aria-label={`Preview ${doc.title}`}>
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <span className="font-display text-[15px] font-[650] tracking-[-0.01em]">{doc.title}</span>
        <SystemChip system={`${system}@${doc.system.split("@")[1] ?? ""}`.replace(/@$/, "")} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{kageRef}</span>
        <span className="text-sm text-muted-foreground">Design system</span>
        <Select value={system} onValueChange={(v) => v && setSystem(v)}>
          <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
          <SelectContent>{SYSTEMS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="icon" variant="ghost" aria-label="Close preview" onClick={onClose}><X /></Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <KageRenderer doc={doc} system={system} />
      </div>
    </div>
  );
}
