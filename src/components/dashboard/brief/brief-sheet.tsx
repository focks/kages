"use client";

// The workspace brief: view and edit in a slide-over. Everything goes through the
// one operation set (get_brief / set_brief); the form logic is the pure brief-model.
// The text here is product truth that agents load first, so the sheet says so, and
// a save sends baseRevision so a concurrent edit is reported, never overwritten.
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { op } from "@/components/dashboard/kage-ui";
import { BRIEF_FORM_FIELDS, changedFields, fromForm, problems, toForm, type FormState } from "./brief-model";

export interface BriefData { brief: (Record<string, unknown> & { inferred?: string[] }) | null; revision: number; updatedBy?: string; updatedAt?: string; warnings?: string[] }

/** The current brief, or null for "this person may not see one". Used by the Library to decide whether to prompt. */
export async function loadBrief(): Promise<BriefData | null> {
  try { return await op<BriefData>("get_brief"); } catch { return null; }
}

const field = "w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function BriefSheet({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: (b: BriefData) => void }) {
  const [data, setData] = useState<BriefData | null | undefined>(undefined);
  const [form, setForm] = useState<FormState>(() => toForm(null));
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);

  const load = useCallback(async () => {
    setData(undefined); setConflict(false);
    const d = await loadBrief();
    setData(d);
    setForm(toForm(d?.brief));
  }, []);
  useEffect(() => { if (open) void load(); }, [open, load]);

  const original = useMemo(() => toForm(data?.brief), [data]);
  const dirty = changedFields(original, form).length > 0;
  const issues = problems(form);
  const inferred = data?.brief?.inferred ?? [];

  async function save() {
    setSaving(true);
    try {
      // Fields the person edited are theirs now: only untouched drafts stay "inferred".
      const edited = new Set(changedFields(original, form));
      const body = fromForm(form, inferred.filter((k) => !edited.has(k)));
      const r = await op<BriefData>("set_brief", { brief: body, baseRevision: data?.revision ?? 0 });
      toast.success(`Brief saved (revision ${r.revision})`);
      for (const w of r.warnings ?? []) toast.warning(w);
      onSaved(r); onOpenChange(false);
    } catch (e) {
      const msg = (e as Error).message;
      if (/revision/.test(msg)) setConflict(true); else toast.error(msg);
    } finally { setSaving(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle>Workspace brief</SheetTitle>
          <SheetDescription>What every agent here should know before it builds. It is data to them, never instructions.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {data === undefined && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
          {data === null && <p className="text-sm text-muted-foreground">You don't have access to this workspace's brief. Ask an admin of a project.</p>}
          {data && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save(); }}>
              {conflict && (
                <div role="alert" className="rounded-md border border-warning/50 bg-warning-soft p-3 text-sm">
                  Someone saved a newer brief while you were editing. <Button type="button" size="xs" variant="outline" onClick={() => void load()}>Reload it</Button> to see their version; your text here will be replaced.
                </div>
              )}
              {data.revision > 0 && <p className="font-mono text-xs text-muted-foreground">revision {data.revision}{data.updatedBy ? ` · ${data.updatedBy}` : ""}</p>}
              {inferred.length > 0 && <p className="text-sm text-muted-foreground">Unconfirmed drafts: {inferred.join(", ")}. Editing a field confirms it.</p>}
              {BRIEF_FORM_FIELDS.map((m) => {
                const bad = issues.find((p) => p.key === m.key);
                return (
                  <div key={m.key} className="space-y-1">
                    <label htmlFor={`brief-${m.key}`} className="text-sm font-medium">{m.label}{m.required && <span className="text-destructive"> *</span>}{inferred.includes(m.key) && <span className="ml-2 font-mono text-[11px] font-normal text-muted-foreground">draft</span>}</label>
                    <textarea id={`brief-${m.key}`} rows={m.rows} value={form[m.key] ?? ""} spellCheck={m.kind === "text"} aria-invalid={!!bad && dirty} aria-describedby={`brief-${m.key}-help`}
                      onChange={(e) => setForm({ ...form, [m.key]: e.target.value })} className={cn(field, m.kind !== "text" && "font-mono text-[13px]")} />
                    <p id={`brief-${m.key}-help`} className={cn("text-xs", bad && dirty ? "text-destructive" : "text-muted-foreground")}>{bad && dirty ? bad.message : m.help}</p>
                  </div>
                );
              })}
            </form>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t p-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!data || !dirty || saving || issues.length > 0} onClick={() => void save()}>{saving ? "Saving…" : "Save brief"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
