"use client";
// Proposals come from the operation table so agents and people receive the same
// checks. A version guard prevents Apply or Undo overwriting concurrent edits.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { op } from "@/components/dashboard/kage-ui";
import { KageRenderer } from "@/runtime/SandboxedKage";
import type { KageDoc } from "@/engine/types";
import type { PatchOp } from "@/collab/patch";
import type { PolishFinding } from "@/authoring/polish";

interface Proposal { from: number; patch: PatchOp[]; undo: PatchOp[]; preview: KageDoc; findings: PolishFinding[]; changes: string[]; validation: { errors: unknown[] }; version?: { v: number } }

/** Apply and undo both create versions; the signed source is never restyled in place. */
export function PolishPanel({ name, doc, onChanged }: { name: string; doc: KageDoc; onChanged: () => Promise<void> }) {
  const [personality, setPersonality] = useState("analytical"), [density, setDensity] = useState("comfortable"), [appearance, setAppearance] = useState("inherit");
  const [plan, setPlan] = useState<Proposal | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [before, setBefore] = useState(false), [narrow, setNarrow] = useState(false), [undo, setUndo] = useState<{ ops: PatchOp[]; version: number } | null>(null);
  useEffect(() => { setPlan(null); setUndo(null); setError(""); }, [name]);
  async function propose() {
    setBusy(true); setError("");
    try { setPlan(await op<Proposal>("polish_kage", { name, personality, density, appearance })); setBefore(false); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function apply() {
    if (!plan) return;
    setBusy(true); setError("");
    try {
      const result = await op<Proposal>("polish_kage", { name, personality, density, appearance, apply: true, baseVersion: plan.from });
      setUndo({ ops: result.undo, version: result.version!.v }); setPlan(null); await onChanged();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function revert() {
    if (!undo) return;
    setBusy(true); setError("");
    try { await op("patch_kage", { name, ops: undo.ops, baseVersion: undo.version }); setUndo(null); setPlan(null); await onChanged(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const selectClass = "mt-1 block w-full rounded-md border border-input bg-background px-2 py-1 text-sm";
  return <details className="rounded-xl border p-3">
    <summary className="cursor-pointer text-sm font-medium">Polish presentation</summary>
    <p className="my-3 text-sm text-muted-foreground">Preview a coherent style. Data, text and controls are preserved. Saving creates a draft revision; publish it separately when ready.</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs">Personality<select className={selectClass} value={personality} disabled={busy} onChange={e => { setPersonality(e.target.value); setPlan(null); }}>{["analytical", "editorial", "exploratory", "teaching", "showcase"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="text-xs">Density<select className={selectClass} value={density} disabled={busy} onChange={e => { setDensity(e.target.value); setPlan(null); }}>{["comfortable", "compact"].map(v => <option key={v}>{v}</option>)}</select></label>
      <label className="text-xs">Appearance<select className={selectClass} value={appearance} disabled={busy} onChange={e => { setAppearance(e.target.value); setPlan(null); }}>{["inherit", "light", "dark"].map(v => <option key={v}>{v}</option>)}</select></label>
    </div>
    <div className="my-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void propose()}>Preview changes</Button>{undo && <Button variant="outline" size="sm" disabled={busy} onClick={() => void revert()}>Undo polish in a new version</Button>}</div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {undo && <p role="status" className="text-sm text-muted-foreground">Saved as version {undo.version}. Undo is available while that remains the latest revision.</p>}
    {plan && <div className="space-y-3">
      <ul className="list-disc space-y-1 pl-5 text-sm">{plan.changes.map(change => <li key={change}>{change}</li>)}</ul>
      {!!plan.findings.length && <details><summary className="cursor-pointer text-sm">{plan.findings.length} suggestions to review</summary><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{plan.findings.map((finding, i) => <li key={i}><code>{finding.block}</code>: {finding.message}</li>)}</ul></details>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setBefore(!before)}>{before ? "Show proposed" : "Show original"}</Button><Button size="sm" variant="outline" onClick={() => setNarrow(!narrow)}>{narrow ? "Use full width" : "Use phone width"}</Button><span className="self-center text-xs text-muted-foreground">{before ? "Original" : "Proposed"} · source v{plan.from}</span></div>
      <div className="max-h-[60svh] overflow-auto rounded-xl border"><div style={{ width: narrow ? 390 : "100%", maxWidth: "100%", marginInline: "auto" }}><KageRenderer doc={before ? doc : plan.preview} /></div></div>
      <details><summary className="cursor-pointer text-xs">Inspect proposed patch</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(plan.patch, null, 2)}</pre></details>
      {plan.validation.errors.length > 0 && <p role="alert" className="text-sm text-destructive">The proposal has validation errors. Resolve them before saving.</p>}
      <Button size="sm" disabled={busy || plan.validation.errors.length > 0} onClick={() => void apply()}>Save polished version</Button>
    </div>}
  </details>;
}
