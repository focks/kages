"use client";

// The inspector for the selected block, in three tabs:
//  • Props    — generated from the contract; you can only set declared props,
//               typed by their spec (string/number/boolean/enum). A bound prop
//               is shown read-only here (edit it under Bindings).
//  • Bindings — each prop can be wired to an expression; edited as JSON so any
//               operator ($state/$block/$if/…) is expressible without a bespoke
//               builder. Invalid JSON is reported inline and not applied.
//  • Actions  — per contract event, the Action[] run on that event, as JSON.
// Validation findings for this block ring the offending field in red.

import * as React from "react";
import { resolve } from "@/engine/resolve";
import type { PatchOp } from "@/collab/patch";
import type { KageDoc, PropSpec, Finding } from "@/engine/types";
import { pointerToField } from "./problems";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

/** A JSON-valued textarea: parses on change, reports a parse error inline, and
 *  only calls onCommit with valid JSON. Used for bindings and action lists. */
function JsonField({ value, onCommit, placeholder, invalid }: {
  value: unknown; onCommit: (v: unknown) => void; placeholder?: string; invalid?: string;
}) {
  const [text, setText] = React.useState(() => JSON.stringify(value ?? null, null, 2));
  const [err, setErr] = React.useState<string | null>(null);
  React.useEffect(() => { setText(JSON.stringify(value ?? null, null, 2)); setErr(null); }, [value]);
  return (
    <div className="space-y-1">
      <textarea
        value={text} spellCheck={false} placeholder={placeholder} rows={Math.min(8, text.split("\n").length)}
        onChange={(e) => {
          setText(e.target.value);
          try { onCommit(JSON.parse(e.target.value)); setErr(null); } catch (x) { setErr((x as Error).message); }
        }}
        className={cn("w-full resize-y rounded-sm border bg-background p-2 font-mono text-[12px] leading-[17px] outline-none focus-visible:ring-1 focus-visible:ring-ring",
          (err || invalid) && "border-destructive focus-visible:ring-destructive")}
      />
      {(err || invalid) && <p className="text-xs text-destructive">{err ?? invalid}</p>}
    </div>
  );
}

export function Inspector({ doc, id, onPatch, findings }: {
  doc: KageDoc; id: string; onPatch: (ops: PatchOp[]) => void; findings: Finding[];
}) {
  const b = doc.blocks[id];
  const r = resolve(doc.system.split("@")[0], b.type);
  if (!r.contract) return <p className="text-sm text-destructive">Unresolved: {r.error}</p>;
  const c = r.contract;
  const bound = new Set(Object.keys(b.bind ?? {}));

  // field -> message, for ringing the exact input.
  const errAt = new Map<string, string>();
  for (const f of findings) { const fd = pointerToField(f.at); if (fd.key) errAt.set(`${fd.section}/${fd.key}`, f.msg); }

  function setProp(key: string, raw: string, spec: PropSpec) {
    let value: unknown = raw;
    if (spec.type === "number") value = raw === "" ? 0 : Number(raw);
    if (spec.type === "boolean") value = raw === "true";
    const exists = (b.props ?? {})[key] !== undefined;
    onPatch([{ op: exists ? "replace" : "add", path: `/blocks/${id}/props/${key}`, value: value as never }]);
  }
  function setMap(section: "bind" | "on", key: string, value: unknown) {
    const map = (section === "bind" ? b.bind : b.on) as Record<string, unknown> | undefined;
    const exists = (map ?? {})[key] !== undefined;
    const hasObj = map !== undefined;
    const ops: PatchOp[] = [];
    if (!hasObj) ops.push({ op: "add", path: `/blocks/${id}/${section}`, value: { [key]: value } as never });
    else ops.push({ op: exists ? "replace" : "add", path: `/blocks/${id}/${section}/${key}`, value: value as never });
    onPatch(ops);
  }
  function unset(section: "bind" | "on", key: string) {
    onPatch([{ op: "remove", path: `/blocks/${id}/${section}/${key}` }]);
  }

  const unboundProps = Object.keys(c.props).filter((k) => !bound.has(k));
  const events = Object.keys(c.events);

  return (
    <div>
      <h3 className="font-mono text-sm font-semibold">{id}</h3>
      <p className="mb-3 text-xs text-muted-foreground"><span className="font-mono">{c.ref}</span> · {c.summary}</p>

      <Tabs defaultValue="props">
        <TabsList variant="line" className="w-full justify-start gap-4 border-b">
          <TabsTrigger value="props" className="flex-none">Props</TabsTrigger>
          <TabsTrigger value="bindings" className="flex-none">Bindings{bound.size ? ` (${bound.size})` : ""}</TabsTrigger>
          <TabsTrigger value="actions" className="flex-none">Actions{b.on ? ` (${Object.keys(b.on).length})` : ""}</TabsTrigger>
        </TabsList>

        {/* PROPS */}
        <TabsContent value="props" className="mt-3 space-y-3">
          {Object.entries(c.props).map(([key, spec]) => {
            const val = (b.props ?? {})[key];
            const isBound = bound.has(key);
            const editable = !isBound && ["string", "number", "boolean"].includes(spec.type ?? "") && !spec.enum;
            const msg = errAt.get(`props/${key}`);
            return (
              <div key={`${id}:${key}`} className="space-y-1">
                <label className="font-mono text-xs text-muted-foreground">{key}{spec.required ? " *" : ""} <span className="italic opacity-70">{spec.type}</span></label>
                {isBound ? (
                  <div className="inline-flex items-center gap-1.5 rounded-sm bg-wire-soft px-2 py-1 font-mono text-xs text-wire">
                    <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-wire" />{JSON.stringify(b.bind![key])}
                  </div>
                ) : spec.enum ? (
                  <Select value={val === undefined ? null : String(val)} onValueChange={(v) => setProp(key, v ?? "", spec)}>
                    <SelectTrigger className={cn("h-8", msg && "border-destructive")}><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>{spec.enum.map((o) => <SelectItem key={String(o)} value={String(o)}>{String(o)}</SelectItem>)}</SelectContent>
                  </Select>
                ) : editable ? (
                  <Input defaultValue={val === undefined ? "" : String(val)} onBlur={(e) => setProp(key, e.target.value, spec)} className={cn("h-8", msg && "border-destructive")} />
                ) : (
                  <div className="whitespace-pre-wrap break-all font-mono text-[11px] text-muted-foreground">{val === undefined ? "—" : JSON.stringify(val)}</div>
                )}
                {msg && <p className="text-xs text-destructive">{msg}</p>}
              </div>
            );
          })}
        </TabsContent>

        {/* BINDINGS */}
        <TabsContent value="bindings" className="mt-3 space-y-3">
          {[...bound].map((key) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center gap-2">
                <label className="flex-1 font-mono text-xs text-wire">{key}</label>
                <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => unset("bind", key)}>unbind</Button>
              </div>
              <JsonField value={b.bind![key]} onCommit={(v) => setMap("bind", key, v)} invalid={errAt.get(`bind/${key}`)} />
            </div>
          ))}
          {unboundProps.length > 0 && (
            <Select value={null} onValueChange={(k) => k && setMap("bind", k, { $state: "" })}>
              <SelectTrigger className="h-8"><SelectValue placeholder="+ bind a prop…" /></SelectTrigger>
              <SelectContent>{unboundProps.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </TabsContent>

        {/* ACTIONS */}
        <TabsContent value="actions" className="mt-3 space-y-3">
          {events.length === 0 && <p className="text-xs text-muted-foreground">This component emits no events.</p>}
          {events.map((ev) => {
            const has = !!(b.on ?? {})[ev];
            return (
              <div key={ev} className="space-y-1">
                <div className="flex items-center gap-2">
                  <label className="flex-1 font-mono text-xs text-muted-foreground">on {ev}</label>
                  {has && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => unset("on", ev)}>clear</Button>}
                </div>
                {has
                  ? <JsonField value={(b.on ?? {})[ev]} onCommit={(v) => setMap("on", ev, v)} invalid={errAt.get(`on/${ev}`)} />
                  : <Button size="sm" variant="outline" className="h-7" onClick={() => setMap("on", ev, [{ do: "log", message: ev }])}>+ add handler</Button>}
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
