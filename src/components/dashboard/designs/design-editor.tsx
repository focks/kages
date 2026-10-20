"use client";

// The design editor: a slide-over with the definition on one side and a live preview on the other. The preview is
// the real sandboxed renderer with the draft design handed to it, so what you see is what a Kage will pin. Every
// edit restyles the open frame in place (no reload). Saving goes through set_design, with baseRevision so a
// concurrent edit is reported rather than overwritten.
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { KageRenderer } from "@/runtime/KageRenderer";
import { op } from "@/components/dashboard/kage-ui";
import { cn } from "@/lib/utils";
import { DESIGN_BASES, FONTS, basePalette, designContrast, normalizeHex, paletteFromBrand, resolveDesign, type DesignBase, type DesignDef, type Mode, type Palette } from "@/engine/design";
import { RADIUS_PRESETS, ROLE_GROUPS, blankState, previewDoc, slugify, snapshotOf, stateFromRecord, toDefinition, type EditorState } from "./design-model";
import { selectField } from "./design-select";

const field = "h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive";
const label = "text-sm font-medium";
const basePal = (b: DesignBase): Record<Mode, Palette> => ({ light: basePalette(b, "light"), dark: basePalette(b, "dark") });

/** A colour with a native picker and a hex box. The box keeps what you type until it is a valid colour. */
function ColorField({ value, onChange, name }: { value: string; onChange: (hex: string) => void; name: string }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const bad = text !== value && !normalizeHex(text);
  return (
    <div className="flex items-center gap-2">
      <input type="color" aria-label={`${name} colour`} value={value} onChange={(e) => onChange(e.target.value)} className="size-8 shrink-0 cursor-pointer rounded border border-input bg-transparent p-0.5" />
      <input aria-label={`${name} hex`} aria-invalid={bad} value={text} spellCheck={false} maxLength={7}
        onChange={(e) => { setText(e.target.value); const h = normalizeHex(e.target.value); if (h) onChange(h); }}
        onBlur={() => setText(value)} className={cn(field, "h-8 w-24 font-mono text-xs")} />
    </div>
  );
}

export interface EditorTarget { id: string | null }

export function DesignEditor({ open, onOpenChange, target, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; target: EditorTarget | null; onSaved: () => void }) {
  const [state, setState] = useState<EditorState | null>(null);
  const [mode, setMode] = useState<Mode>("light");
  const [brand, setBrand] = useState("#0b5fff");
  const [saving, setSaving] = useState(false);
  const [idTouched, setIdTouched] = useState(false);

  useEffect(() => {
    if (!open || !target) return;
    setState(null); setMode("light"); setIdTouched(false);
    if (target.id === null) { const base: DesignBase = "core"; setState(blankState(base, resolveDesign({ id: "x", name: "x", base }))); return; }
    void op<{ definition: DesignDef; snapshot: ReturnType<typeof resolveDesign>; revision: number; default: boolean }>("get_design", { id: target.id })
      .then((r) => setState(stateFromRecord({ def: r.definition, revision: r.revision, default: r.default }, r.snapshot)))
      .catch((e) => { toast.error(String(e.message)); onOpenChange(false); });
  }, [open, target, onOpenChange]);

  const snap = useMemo(() => (state ? snapshotOf(state) : null), [state]);
  const failing = useMemo(() => (snap ? designContrast(snap).filter((r) => !r.ok) : []), [snap]);
  const doc = useMemo(() => previewDoc(state?.base ?? "core"), [state?.base]);
  const set = (patch: Partial<EditorState>) => setState((s) => (s ? { ...s, ...patch } : s));
  const setColor = (m: Mode, role: keyof Palette, hex: string) => setState((s) => (s ? { ...s, [m]: { ...s[m], [role]: hex } } : s));

  function changeBase(base: DesignBase) {
    // Switching base re-seeds colours the person has not customised; customised ones would be lost, so ask first.
    if (!state) return;
    const was = basePal(state.base);
    const touched = (["light", "dark"] as const).some((m) => Object.keys(was[m]).some((r) => state[m][r as keyof Palette].toLowerCase() !== was[m][r as keyof Palette].toLowerCase()));
    if (touched && !window.confirm("Switching the base system resets your colours to its palette. Continue?")) return;
    const n = basePal(base);
    set({ base, light: { ...n.light }, dark: { ...n.dark } });
  }
  function generate() {
    const p = paletteFromBrand(brand);
    if (!p) return toast.error("Pick a valid colour first");
    set({ light: p.light, dark: p.dark });
    toast.success("Palette generated: every text pair passes its contrast minimum");
  }

  const problems: string[] = [];
  if (state) {
    if (!state.name.trim()) problems.push("Give it a name");
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(state.id)) problems.push("The id is lowercase letters, digits and hyphens");
  }

  async function save() {
    if (!state) return;
    setSaving(true);
    try {
      const r = await op<{ warnings?: string[]; revision: number }>("set_design", { definition: toDefinition(state, basePal(state.base)), baseRevision: state.revision ?? 0, default: state.isDefault });
      toast.success(`Saved “${state.name}” (revision ${r.revision})`);
      for (const w of r.warnings ?? []) toast.warning(w);
      onSaved(); onOpenChange(false);
    } catch (e) { toast.error(String((e as Error).message)); } finally { setSaving(false); }
  }
  async function remove() {
    if (!state || state.revision === null || !window.confirm(`Delete “${state.name}”? Kages already using it keep the look they were saved with.`)) return;
    try { await op("delete_design", { id: state.id }); toast.success("Design deleted"); onSaved(); onOpenChange(false); } catch (e) { toast.error(String((e as Error).message)); }
  }

  const fontOptions = (kind: string[]) => FONTS.filter((f) => kind.includes(f.kind));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-5xl">
        <SheetHeader className="border-b">
          <SheetTitle>{state?.revision === null ? "New design" : state ? `Design · ${state.name || state.id}` : "Design"}</SheetTitle>
          <SheetDescription>Colours, type and corners for the Kages that use it. Roles you do not change keep inheriting from the base system.</SheetDescription>
        </SheetHeader>
        {!state || !snap ? <div className="space-y-3 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div> : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] overflow-y-auto lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:overflow-hidden">
            <div className="space-y-5 p-4 lg:overflow-y-auto">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><label className={label} htmlFor="d-name">Name</label>
                  <input id="d-name" className={field} value={state.name} maxLength={60} onChange={(e) => set({ name: e.target.value, ...(state.revision === null && !idTouched ? { id: slugify(e.target.value) } : {}) })} /></div>
                <div className="space-y-1"><label className={label} htmlFor="d-id">Id</label>
                  <input id="d-id" className={cn(field, "font-mono text-xs")} value={state.id} disabled={state.revision !== null} maxLength={40} onChange={(e) => { setIdTouched(true); set({ id: e.target.value.toLowerCase() }); }} /></div>
              </div>
              <div className="space-y-1"><label className={label} htmlFor="d-desc">Description</label>
                <input id="d-desc" className={field} value={state.description} maxLength={200} placeholder="When to use this design" onChange={(e) => set({ description: e.target.value })} /></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1"><label className={label} htmlFor="d-base">Base system</label>
                  <select id="d-base" className={selectField} value={state.base} onChange={(e) => changeBase(e.target.value as DesignBase)}>{DESIGN_BASES.map((b) => <option key={b} value={b}>{b}</option>)}</select></div>
                <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={state.isDefault} onChange={(e) => set({ isDefault: e.target.checked })} /> New Kages start in this design</label>
              </div>

              <section className="space-y-2 rounded-lg border p-3">
                <h3 className={label}>Start from a brand colour</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <ColorField name="Brand" value={brand} onChange={setBrand} />
                  <Button type="button" size="sm" variant="outline" onClick={generate}>Generate palette</Button>
                </div>
                <p className="text-xs text-muted-foreground">Builds both themes from one colour and nudges every text colour until it passes its contrast minimum. Edit any role afterwards.</p>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between"><h3 className={label}>Colours</h3>
                  <div role="tablist" aria-label="Theme" className="inline-flex rounded-md border p-0.5">
                    {(["light", "dark"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded px-3 py-1 text-xs capitalize", mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>{m}</button>)}
                  </div></div>
                {ROLE_GROUPS.map((g) => (
                  <div key={g.title} className="space-y-1.5">
                    <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{g.title}</p>
                    {g.roles.map((r) => (
                      <div key={r.role} className="flex items-center justify-between gap-3">
                        <div className="min-w-0"><div className="text-sm">{r.label}</div><div className="truncate text-xs text-muted-foreground">{r.help}</div></div>
                        <ColorField name={`${r.label} ${mode}`} value={state[mode][r.role]} onChange={(hex) => setColor(mode, r.role, hex)} />
                      </div>
                    ))}
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <h3 className={label}>Type</h3>
                {([["body", "Body", ["sans", "serif"]], ["display", "Headings and figures", ["sans", "serif"]], ["mono", "Code and numbers", ["mono"]]] as const).map(([slot, text, kinds]) => (
                  <div key={slot} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-2">
                    <label className="text-sm" htmlFor={`f-${slot}`}>{text}</label>
                    <select id={`f-${slot}`} className={selectField} value={state.fonts[slot]} onChange={(e) => set({ fonts: { ...state.fonts, [slot]: e.target.value } })}>
                      <option value="">From the base system</option>
                      {fontOptions([...kinds]).map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
                    </select>
                  </div>
                ))}
              </section>

              <section className="space-y-2">
                <div className="flex items-center justify-between"><h3 className={label}>Corners</h3>
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={state.radius.on} onChange={(e) => set({ radius: { ...state.radius, on: e.target.checked } })} /> Override</label></div>
                {state.radius.on && (
                  <>
                    <div className="flex gap-2">{RADIUS_PRESETS.map((p) => <Button key={p.label} type="button" size="xs" variant="outline" onClick={() => set({ radius: { on: true, sm: p.sm, md: p.md, lg: p.lg } })}>{p.label}</Button>)}</div>
                    <div className="grid grid-cols-3 gap-2">
                      {(["sm", "md", "lg"] as const).map((k) => (
                        <label key={k} className="space-y-1 text-xs text-muted-foreground">{k === "sm" ? "Small" : k === "md" ? "Medium" : "Large"} (px)
                          <input type="number" min={0} max={40} className={field} value={state.radius[k]} onChange={(e) => set({ radius: { ...state.radius, [k]: Math.max(0, Math.min(40, Math.round(Number(e.target.value) || 0))) } })} /></label>
                      ))}
                    </div>
                  </>
                )}
              </section>
            </div>

            <div className="flex min-h-0 flex-col border-t bg-muted/30 lg:border-t-0 lg:border-l">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
                <p className="text-sm font-medium">Live preview <span className="font-normal text-muted-foreground">· {mode}</span></p>
                <p role="status" className={cn("text-xs", failing.length ? "text-destructive" : "text-muted-foreground")}>
                  {failing.length ? `${failing.length} contrast pair${failing.length === 1 ? "" : "s"} below minimum` : "Every contrast pair passes"}
                </p>
              </div>
              <div className="min-h-[24rem] flex-1 overflow-y-auto"><KageRenderer doc={doc} design={snap} dark={mode === "dark"} /></div>
              {failing.length > 0 && (
                <details className="border-t p-3 text-xs">
                  <summary className="cursor-pointer font-medium">What fails</summary>
                  <ul className="mt-2 space-y-1 font-mono">{failing.slice(0, 12).map((r) => <li key={r.mode + r.text + r.on}>{r.mode}: {r.text} on {r.on} is {r.ratio}:1, needs {r.min}:1 <span className="font-sans text-muted-foreground">({r.role})</span></li>)}</ul>
                </details>
              )}
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 border-t p-3">
          {state && state.revision !== null && <Button variant="ghost" className="text-destructive" onClick={() => void remove()}>Delete</Button>}
          <p className="ml-auto text-xs text-destructive">{problems[0]}</p>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
          <Button disabled={!state || saving || problems.length > 0} onClick={() => void save()}>{saving ? "Saving…" : "Save design"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
