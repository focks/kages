// Builds the shared facts every rule reads, once per document. This is the old
// `lint()` preamble moved verbatim: the two-pass shape matters because a rule
// about block A must be able to see a read that lives in block Z.
import { resolve, systemOf } from "../resolve.ts";
import { walkExpr } from "../expr.ts";
import type { Block, KageDoc } from "../types.ts";
import { modeOf } from "../mode.ts";
import { REGISTRY, type Deprecation } from "../deprecations.ts";
import type { LintContext, Mode, TplRef } from "./types.ts";

/** Every `on` handler as a flat list of actions. */
function actionsOf(doc: KageDoc): LintContext["actions"] {
  const out: LintContext["actions"] = [];
  for (const [id, b] of Object.entries(doc.blocks))
    for (const [event, h] of [...Object.entries(b.on && typeof b.on === "object" ? b.on : {}), ...Object.entries(b.watch && typeof b.watch === "object" ? b.watch : {}).map(([p, v]) => ["watch:" + p, v] as const)]) for (const a of Array.isArray(h) ? h : [h]) if (a && typeof a === "object") out.push({ id, event, action: a as unknown as Record<string, unknown> });
  return out;
}

/** Every expression-bearing value in a block, with its JSON pointer. */
function exprsOf(id: string, b: Block): { at: string; value: unknown }[] {
  const base = "/blocks/" + id;
  return [{ at: base + "/props", value: b.props }, { at: base + "/bind", value: b.bind }, { at: base + "/visible", value: b.visible }, { at: base + "/on", value: b.on }, { at: base + "/watch", value: b.watch }, { at: base + "/repeat", value: b.repeat }].filter((e) => e.value !== undefined);
}

export function buildContext(given: KageDoc, override?: string, deprecations: readonly Deprecation[] = REGISTRY, absent: readonly string[] = []): LintContext {
  const input = (given && typeof given === "object" ? given : {}) as KageDoc;
  const system = override ?? systemOf(input);
  // Documents are untrusted: tolerate anything shaped wrongly rather than throw,
  // since lint runs on drafts an agent is still assembling.
  const raw = input && typeof input.blocks === "object" && input.blocks ? input.blocks : {};
  const blocks: KageDoc["blocks"] = Object.fromEntries(Object.entries(raw).filter(([, b]) => b && typeof b === "object"));
  const doc = { ...input, blocks } as KageDoc;
  const actions = actionsOf(doc);
  const reads = new Set<string>();
  const stateKeys = new Set(Object.keys(doc.state ?? {}));
  const handled = new Set(actions.map((a) => a.id + ":" + a.event));
  const tplRefs: TplRef[] = [];

  for (const [id, b] of Object.entries(blocks)) {
    for (const { at, value } of exprsOf(id, b)) {
      walkExpr(value as never, (op, arg) => {
        if (op === "$block") reads.add(String(arg));
        if (op === "$tpl" && typeof arg === "string") {
          for (const m of arg.matchAll(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g)) {
            const [, ns, path] = m;
            tplRefs.push({ at, ns, path });
            if (ns === "block") reads.add(path);
          }
        }
      });
    }
  }

  const reach = new Set<string>();
  const visit = (id: string) => { if (reach.has(id) || !blocks[id]) return; reach.add(id); for (const kids of Object.values(blocks[id].slots ?? {})) if (Array.isArray(kids)) kids.forEach(visit); };
  if (doc.root) visit(doc.root);
  const referenced = new Set<string>();
  for (const r of reads) referenced.add(r.split(".")[0]);
  for (const a of actions) if (typeof a.action.target === "string") referenced.add(a.action.target);

  // Declared mode wins. A guess only counts when it is confident: a mode-gated rule
  // firing on a coin-flip inference would be noise nobody can fix by editing.
  const m = modeOf(doc);
  const mode: Mode | undefined = m.source === "declared" || m.confidence === "medium" ? m.mode : undefined;

  const enumCache = new Map<string, ReadonlySet<string>>();
  const enumPropsOf = (type: string): ReadonlySet<string> => {
    let set = enumCache.get(type);
    if (!set) { const props = (resolve(system, type).contract?.props ?? {}) as Record<string, { enum?: unknown }>; set = new Set(Object.entries(props).filter(([, v]) => Array.isArray(v?.enum)).map(([k]) => k)); enumCache.set(type, set); }
    return set;
  };

  return { doc, system, deprecations, absent, enumPropsOf, blocks, actions, handled, reads, stateKeys, tplRefs, reach, referenced, mode, outputsOf: (type) => resolve(system, type).contract?.outputs ?? [] };
}
