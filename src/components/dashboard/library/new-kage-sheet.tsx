"use client";

// "New Kage": pick a starting shape and it is created in the current project. This replaces the old Studio
// editor; from here a Kage is edited by an agent (CLI, MCP, REST) or by importing a changed file.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { op } from "@/components/dashboard/kage-ui";
import { starterDocs } from "@/packs/starters";
import { DesignSelect, useDesigns } from "@/components/dashboard/designs/design-select";

export function NewKageSheet({ open, onOpenChange, repo, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; repo: string; onCreated: (name: string) => void | Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const designs = useDesigns(open);
  // "" is a real choice (no design), distinct from "not chosen yet" (null), so a workspace default can be declined.
  const [design, setDesign] = useState<string | null>(null);
  useEffect(() => { if (open) setDesign(null); }, [open]);
  const chosen = design ?? designs?.default ?? "";
  async function create(id: string) {
    const doc = starterDocs().find((d) => d.id === id);
    if (!doc) return;
    setBusy(id);
    try {
      // A short suffix keeps a second copy of the same starter from colliding with the first.
      const named = { ...doc, id: `${doc.id}-${Math.random().toString(36).slice(2, 6)}` };
      // A design is a skin on its base system, so the Kage takes that system; "" tells the store not to apply the default.
      const picked = designs?.designs.find((d) => d.id === chosen);
      Object.assign(named, { design: chosen }, picked ? { system: `${picked.base}@1` } : {});
      const r = await op<{ version: { name: string } }>("create_kage", { doc: named, repo });
      toast.success(`Created ${doc.title} in ${repo}`);
      onOpenChange(false);
      await onCreated(r.version.name);
    } catch (e) { toast.error(String((e as Error).message || e)); } finally { setBusy(null); }
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New Kage</SheetTitle>
          <SheetDescription>Start from a working example in “{repo}”. Ask an agent to change it, or import an edited file.</SheetDescription>
        </SheetHeader>
        {designs && designs.designs.length > 0 && (
          <div className="space-y-1 px-4">
            <label htmlFor="new-design" className="text-sm font-medium">Design</label>
            <DesignSelect id="new-design" value={chosen} onChange={setDesign} designs={designs.designs} />
            <p className="text-xs text-muted-foreground">You can change it later from the Kage&apos;s details.</p>
          </div>
        )}
        <div className="grid gap-2 p-4">
          {starterDocs().map((d) => (
            <Button key={d.id} variant="outline" disabled={busy !== null} className="h-auto justify-start whitespace-normal py-2 text-left" onClick={() => void create(d.id)}>
              {busy === d.id ? "Creating…" : d.title}
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
