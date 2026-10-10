"use client";

// The shareable published-Kage link: /k/<name>. This is where a "publishable
// link" points — a bare page with no dashboard chrome, the closest this
// single-origin reference comes to the spec's `<id>.kages-usercontent.app`
// render. Access is the store's call, not the page's: get_kage returns the
// document only if the caller may read it (published link/public, or a repo
// grant), so a private Kage's link 404s here for an outsider. The same portable
// document can be swapped between design systems, exactly as in the workbench.

import { use, useEffect, useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SystemChip, op } from "@/components/dashboard/kage-ui";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";

const SYSTEMS = ["core", "ledger", "atelier"] as const;

export default function SharedKagePage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = use(params);
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [system, setSystem] = useState<string>("core");

  useEffect(() => {
    op<KageDoc>("get_kage", { name: decodeURIComponent(name) })
      .then((d) => { setDoc(d); setSystem(d.system.split("@")[0] || "core"); })
      .catch((e) => setErr(String((e as Error).message || e)));
  }, [name]);

  if (err) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-lg font-[650]">This Kage isn’t available</h1>
          <p className="mt-1 text-sm text-muted-foreground">{err} — the link may be private or the Kage may not exist.</p>
        </div>
      </div>
    );
  }
  if (!doc) return <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <span className="font-display text-[15px] font-[650] tracking-[-0.01em]">{doc.title}</span>
        <SystemChip system={`${system}@${doc.system.split("@")[1] ?? ""}`.replace(/@$/, "")} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Design system</span>
          <Select value={system} onValueChange={(v) => v && setSystem(v)}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SYSTEMS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <KageRenderer doc={doc} system={system} />
      </div>
    </div>
  );
}
