"use client";

// "New Kage": pick a starting shape and it is created in the current project. This replaces the old Studio
// editor; from here a Kage is edited by an agent (CLI, MCP, REST) or by importing a changed file.

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { op } from "@/components/dashboard/kage-ui";
import { starterDocs } from "@/packs/starters";

export function NewKageSheet({ open, onOpenChange, repo, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; repo: string; onCreated: (name: string) => void | Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function create(id: string) {
    const doc = starterDocs().find((d) => d.id === id);
    if (!doc) return;
    setBusy(id);
    try {
      // A short suffix keeps a second copy of the same starter from colliding with the first.
      const named = { ...doc, id: `${doc.id}-${Math.random().toString(36).slice(2, 6)}` };
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
