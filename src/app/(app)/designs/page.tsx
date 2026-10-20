"use client";

// Designs: the colour, type and corner definitions a workspace's Kages can wear. A Kage picks one when it is
// created and can change it later; the Kage's version pins what the design looked like at that moment.
import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { DesignEditor, type EditorTarget } from "@/components/dashboard/designs/design-editor";
import { Swatch, loadDesigns, type DesignList } from "@/components/dashboard/designs/design-select";

export default function DesignsPage() {
  const [list, setList] = useState<DesignList | null>(null);
  const [target, setTarget] = useState<EditorTarget | null>(null);
  const [open, setOpen] = useState(false);
  const refresh = useCallback(async () => setList(await loadDesigns()), []);
  useEffect(() => { void refresh(); }, [refresh]);
  const edit = (id: string | null) => { setTarget({ id }); setOpen(true); };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">Designs</h1>
          <p className="text-sm text-muted-foreground">Colours, type and corners your Kages can wear. Pick one when you create a Kage, or change it later from the Library.</p>
        </div>
        <Button onClick={() => edit(null)}><Plus /> New design</Button>
      </div>

      {list === null && <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>}
      {list && list.designs.length === 0 && (
        <Card className="p-6 text-sm text-muted-foreground">
          No designs yet, so every Kage uses its system&apos;s own look. Create one to give your workspace its own palette and type.
          <div className="mt-3"><Button variant="outline" onClick={() => edit(null)}>Create the first design</Button></div>
        </Card>
      )}
      {list && list.designs.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.designs.map((d) => (
            <button key={d.id} onClick={() => edit(d.id)} className="block w-full min-w-0 rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
              <Card className="h-full space-y-3 p-4 transition-colors hover:bg-muted/40">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><div className="truncate font-medium">{d.name}</div><div className="truncate font-mono text-xs text-muted-foreground">{d.id} · {d.base}</div></div>
                  {d.default && <Badge variant="secondary">Default</Badge>}
                </div>
                {d.description && <p className="line-clamp-2 text-sm text-muted-foreground">{d.description}</p>}
                <div className="flex min-w-0 items-center gap-3">
                  <Swatch colors={d.swatch.light} /><Swatch colors={d.swatch.dark} />
                  <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{[d.fonts.display, d.fonts.body, d.fonts.mono].filter(Boolean).join(" · ") || "System type"}</span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}
      <DesignEditor open={open} onOpenChange={setOpen} target={target} onSaved={() => void refresh()} />
    </div>
  );
}
