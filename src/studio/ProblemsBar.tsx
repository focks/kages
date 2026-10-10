"use client";

// The problems strip: every validation finding, errors first, each clickable to
// jump to the exact block (and field) it names. This is the "errors point to the
// exact field" promise — the finding's `at` pointer drives both this list and
// the red ring in the inspector. A clean doc shows a single green line.

import { CircleX, TriangleAlert, CircleCheck } from "lucide-react";
import type { Finding } from "@/engine/types";
import { cn } from "@/lib/utils";

export function ProblemsBar({ errors, warnings, onPick }: {
  errors: Finding[]; warnings: Finding[]; onPick: (f: Finding) => void;
}) {
  const all = [...errors, ...warnings];
  if (all.length === 0) {
    return (
      <div className="flex h-9 items-center gap-2 border-t bg-muted px-3 text-xs text-success">
        <CircleCheck className="size-3.5" /> No problems — valid and clean
      </div>
    );
  }
  return (
    <div className="max-h-40 overflow-auto border-t bg-muted">
      <div className="sticky top-0 flex h-9 items-center gap-3 border-b bg-muted px-3 text-xs font-medium text-muted-foreground">
        {errors.length > 0 && <span className="inline-flex items-center gap-1 text-destructive"><CircleX className="size-3.5" />{errors.length} error{errors.length === 1 ? "" : "s"}</span>}
        {warnings.length > 0 && <span className="inline-flex items-center gap-1 text-warning"><TriangleAlert className="size-3.5" />{warnings.length} warning{warnings.length === 1 ? "" : "s"}</span>}
      </div>
      {all.map((f, i) => {
        const isErr = i < errors.length;
        return (
          <button key={`${f.at}:${f.code}:${i}`} onClick={() => onPick(f)}
            className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent">
            {isErr ? <CircleX className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />}
            <span className="flex-1">{f.msg}</span>
            <span className={cn("shrink-0 font-mono text-[11px] text-muted-foreground")}>{f.at}</span>
          </button>
        );
      })}
    </div>
  );
}
