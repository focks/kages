"use client";

// The viewer: render a Kage and swap its design system live. The same portable
// document renders in core, ledger or atelier with one field changed — System
// Swap made visible. Loads ?kage=<name> from the store, else the bundled fixture.

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { KageFrame } from "@/components/dashboard/kage-ui";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";

const SYSTEMS = ["core", "ledger", "atelier"] as const;

function ViewerInner() {
  const params = useSearchParams();
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [system, setSystem] = useState<(typeof SYSTEMS)[number]>("core");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const name = params.get("kage");
    const url = name ? `/api/get_kage?name=${encodeURIComponent(name)}` : "/ds/ops-console.kage.json";
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d: KageDoc) => { setDoc(d); setSystem((d.system.split("@")[0] as (typeof SYSTEMS)[number]) ?? "core"); })
      .catch((e) => setErr(String(e.message || e)));
  }, [params]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 p-6">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">{doc?.title ?? "Viewer"}</h2>
          <p className="text-sm text-muted-foreground">The same portable Kage in any design system.</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Design system</span>
          <Select value={system} onValueChange={(v) => v && setSystem(v as (typeof SYSTEMS)[number])}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>{SYSTEMS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {err && <Card className="border-destructive p-4 text-sm text-destructive">Failed to load: {err}</Card>}
      {!doc && !err && <Skeleton className="h-96 w-full" />}
      {doc && (
        <KageFrame system={system} kageRef={params.get("kage") ?? "ops-console.kage.json"}>
          <KageRenderer doc={doc} system={system} />
        </KageFrame>
      )}
    </div>
  );
}

export default function ViewerPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}><ViewerInner /></Suspense>;
}
