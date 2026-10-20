"use client";

// One control to pick a workspace design, used when creating a Kage and when changing one later. The list comes
// from the same operation every other client uses (list_designs); "System default" means no design at all.
import { useEffect, useState } from "react";
import { op } from "@/components/dashboard/kage-ui";
import { cn } from "@/lib/utils";

export interface DesignRow {
  id: string; name: string; description?: string; base: "core" | "ledger" | "atelier"; revision: number; default: boolean;
  swatch: { light: string[]; dark: string[] }; fonts: { body?: string; display?: string; mono?: string };
}
export interface DesignList { designs: DesignRow[]; default: string | null }

/** The workspace's designs, or none when this person may not read them. */
export async function loadDesigns(): Promise<DesignList> {
  try { const r = await op<DesignList>("list_designs"); return { designs: r.designs, default: r.default }; } catch { return { designs: [], default: null }; }
}

export function Swatch({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <span aria-hidden className={cn("inline-flex h-5 overflow-hidden rounded border border-border", className)}>
      {colors.map((c, i) => <span key={i} className="w-4" style={{ background: c }} />)}
    </span>
  );
}

export const selectField = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** `value` is a design id, or "" for the system's own look. */
export function DesignSelect({ value, onChange, designs, id, disabled }: { value: string; onChange: (id: string) => void; designs: DesignRow[]; id?: string; disabled?: boolean }) {
  return (
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={selectField}>
      <option value="">System default</option>
      {designs.map((d) => <option key={d.id} value={d.id}>{d.name}{d.default ? " (workspace default)" : ""} · {d.base}</option>)}
    </select>
  );
}

/** Loads the list once for a sheet that opens and closes. */
export function useDesigns(active: boolean): DesignList | null {
  const [list, setList] = useState<DesignList | null>(null);
  useEffect(() => { if (active) void loadDesigns().then(setList); }, [active]);
  return list;
}
