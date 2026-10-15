"use client";

// Fullscreen Kage preview — the former /viewer route, now an overlay so a Kage
// can be previewed in place from the artifacts list or detail without leaving
// the workbench. A chrome bar (title, system, ref, close X) sits over a
// full-bleed KageRenderer; everything below the bar is painted by the Kage's
// OWN design system. The system is fixed at creation and NOT swappable here —
// this is a faithful preview of what a viewer sees, not a system playground.
// Esc or the X closes it.

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SystemChip } from "./kage-ui";
import { MadeWithKages } from "./made-with-kages";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";

/** `body` replaces the plain renderer (the library passes a commentable one). */
export function KagePreview({ doc, kageRef, onClose, body }: { doc: KageDoc; kageRef: string; onClose: () => void; body?: React.ReactNode }) {
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
        <SystemChip system={doc.system} />
        <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{kageRef}</span>
        <Button size="icon" variant="ghost" aria-label="Close preview" onClick={onClose}><X /></Button>
      </div>
      <div className={body ? "min-h-0 flex-1" : "min-h-0 flex-1 overflow-auto"}>
        {body ?? <KageRenderer doc={doc} />}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto"><MadeWithKages /></div>
      </div>
    </div>
  );
}
