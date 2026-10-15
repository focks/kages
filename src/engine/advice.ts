// Advice for agents (and people) who just got a validation result: what to do
// about it, and what the validator cannot see. Two pure functions over a document
// and the installed contracts:
//
//   advise(doc, result) — a concrete fix for each error/warning the validator
//                         raised ("did you mean `bar-chart`?", the valid events,
//                         the readable outputs…).
//   lint(doc)           — pitfalls that are valid but wrong: a button that does
//                         nothing, a modal nothing opens, a table of contents
//                         pointing at a missing anchor, a `$tpl` reading a private
//                         output.
//
// The validator's own messages are pinned byte-for-byte to the oracle by golden
// tests, so none of this rewrites them; it adds a layer beside them. Nothing here
// changes whether a document is valid. See oracle/advice.feature.

import { ACTIONS } from "./runtime-core.ts";
import { resolve, systemOf } from "./resolve.ts";
import { systems } from "./data.ts";
import { validate } from "./validate.ts";
import { walkExpr } from "./expr.ts";
import type { Block, KageDoc, ValidateResult } from "./types.ts";

export interface Advice {
  /** "hint" explains a validator finding; "lint" flags a pitfall the validator allows. */
  level: "hint" | "lint";
  at: string;
  code: string;
  msg: string;
  /** What to change, in one sentence an agent can act on. */
  fix?: string;
}

/** Edit distance, bounded: past `max` the answer no longer matters. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

/** The closest candidate, if it is close enough to be a plausible typo rather
 *  than a coincidence. Case-insensitive; a shared prefix/suffix also counts. */
export function nearest(word: string, candidates: readonly string[]): string | undefined {
  const w = word.toLowerCase();
  let best: string | undefined, bestD = Infinity;
  for (const c of candidates) {
    const lc = c.toLowerCase();
    const d = lc === w ? 0 : distance(w, lc, 4) - (lc.includes(w) || w.includes(lc) ? 1 : 0);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(w.length / 3)) ? best : undefined;
}

const list = (xs: readonly string[]) => (xs.length ? xs.map((x) => "`" + x + "`").join(", ") : "none");
const blockOf = (doc: KageDoc, at: string): { id: string; block: Block } | undefined => {
  const id = /^\/blocks\/([^/]+)/.exec(at)?.[1];
  return id && doc.blocks[id] ? { id, block: doc.blocks[id] } : undefined;
};

/** One fix per validator finding, from the document and the installed contracts. */
export function advise(doc: KageDoc, result: ValidateResult): Advice[] {
  const out: Advice[] = [];
  const system = result.system;
  const roles = Object.keys(systems[system]?.components ?? {});
  const stateKeys = Object.keys(doc.state ?? {});
  const blockIds = Object.keys(doc.blocks);
  const hint = (f: { at: string; code: string }, msg: string, fix?: string) => out.push({ level: "hint", at: f.at, code: f.code, msg, ...(fix ? { fix } : {}) });

  for (const f of [...result.errors, ...result.warnings]) {
    const here = blockOf(doc, f.at);
    const contract = here ? resolve(system, here.block.type).contract : undefined;
    const key = f.at.split("/").pop() ?? "";
    switch (f.code) {
      case "unresolved-type": {
        const type = here?.block.type ?? "";
        const guess = nearest(type, roles);
        hint(f, `\`${here?.id}\` has type \`${type}\`, which ${system} does not install.`, guess ? `Set ${f.at} to "${guess}". Did you mean \`${guess}\`?` : `Pick an installed type: run \`kages catalog ${system}\` (${roles.length} available).`);
        break;
      }
      case "missing-prop": {
        const spec = contract?.props[key];
        const shape = spec ? `${spec.type}${spec.enum ? ` — one of ${spec.enum.map(String).join(", ")}` : ""}` : "a value";
        hint(f, `\`${here?.id}\` needs its \`${key}\` prop (${shape}).`, `Add "${key}" under props of \`${here?.id}\`, or bind it from state or data with bind.${key}.`);
        break;
      }
      case "unknown-prop": {
        const guess = contract && nearest(key, Object.keys(contract.props));
        hint(f, `\`${key}\` is not a prop of ${contract?.ref ?? "this block"}, so it is ignored.`, guess ? `Rename it to \`${guess}\`.` : `Valid props: ${list(Object.keys(contract?.props ?? {}))}. Remove \`${key}\` if it was a guess.`);
        break;
      }
      case "unknown-slot": {
        const guess = contract && nearest(key, Object.keys(contract.slots));
        hint(f, `${contract?.ref ?? "This block"} has no slot \`${key}\`.`, guess ? `Use slot \`${guess}\`.` : `Valid slots: ${list(Object.keys(contract?.slots ?? {}))}.`);
        break;
      }
      case "slot-max":
        hint(f, `Slot \`${key}\` holds a limited number of blocks.`, "Put the blocks in a `stack` or `grid`, then place that single container in the slot.");
        break;
      case "empty-slot":
        hint(f, `Slot \`${key}\` must not be empty.`, `Add at least one block id to ${f.at}.`);
        break;
      case "missing-child":
      case "dangling-ref": {
        const named = /'([^']+)'/.exec(f.msg)?.[1]?.split(".")[0] ?? "";
        const guess = named ? nearest(named, blockIds) : undefined;
        hint(f, `A reference names a block that does not exist (\`${named}\`).`, guess ? `Did you mean \`${guess}\`? Otherwise add a block with id "${named}".` : `Add a block with id "${named}" or point the reference at one of: ${list(blockIds.slice(0, 12))}.`);
        break;
      }
      case "unknown-event": {
        const ev = key, guess = contract && nearest(ev, Object.keys(contract.events));
        hint(f, `${contract?.ref ?? "This block"} never emits \`${ev}\`, so this handler can never run.`, guess ? `Use \`on.${guess}\` instead.` : `It emits: ${list(Object.keys(contract?.events ?? {}))}.${Object.keys(contract?.events ?? {}).length ? "" : " Static blocks have no handlers; put the handler on a control that emits."}`);
        break;
      }
      case "unknown-command": {
        const cmd = /command `([^`]+)`/.exec(f.msg)?.[1] ?? "";
        const target = /^\/blocks\/([^/]+)/.exec(f.at)?.[1];
        hint(f, `The command \`${cmd}\` does not exist on the target block.`, `Check the target's contract commands (\`kages contract <ref>\`); common ones are open, close, toggle, clear.${target ? "" : ""}`);
        break;
      }
      case "unknown-action": {
        const act = /`([^`]+)`/.exec(f.msg)?.[1] ?? "";
        const guess = nearest(act, ACTIONS);
        hint(f, `\`${act}\` is not an action.`, guess ? `Use \`${guess}\`.` : `Actions: ${list(ACTIONS)}.`);
        break;
      }
      case "private-output": {
        const m = /\$block '([^']+)'/.exec(f.msg)?.[1] ?? "", [bid, ...rest] = m.split("."), prop = rest.join(".");
        const outs = resolve(system, doc.blocks[bid]?.type ?? "").contract?.outputs ?? [];
        const guess = prop ? nearest(prop.split(".")[0], outs) : undefined;
        hint(f, `Only a block's declared outputs can be read from elsewhere; \`${prop}\` on \`${bid}\` is internal.`,
          `${guess ? `Read \`${bid}.${guess}\` instead, or ` : outs.length ? `Readable on \`${bid}\`: ${list(outs)}. Or ` : ""}write the value into \`state\` from the block's event, then read it with {"$state": "key"}.`);
        break;
      }
      case "undeclared-state": {
        const k = /'([^'.]+)/.exec(f.msg)?.[1] ?? "", guess = nearest(k, stateKeys);
        hint(f, `State key \`${k}\` is not declared.`, guess ? `Did you mean \`${guess}\`? Otherwise add "${k}": <initial value> to \`state\`.` : `Add "${k}": <initial value> to \`state\` so it has a starting value.`);
        break;
      }
      case "missing-source": {
        const s = /source '([^']+)'/.exec(f.msg)?.[1] ?? "", guess = nearest(s, Object.keys(doc.sources ?? {}));
        hint(f, `The fetch action names a source that is not declared.`, guess ? `Did you mean \`${guess}\`?` : `Declare it: "sources": { "${s}": { "from": "url", "url": "https://…" } }.`);
        break;
      }
      case "limit":
        hint(f, f.msg, "This is advice, not an error; follow the contract's limit if the block must stay readable.");
        break;
      case "two-parents":
        hint(f, "A block can sit in only one slot.", "Create a second block for the other place; duplicate it rather than reusing the id.");
        break;
      case "slot-cycle":
      case "ref-cycle":
        hint(f, "The document loops back on itself.", "Break the cycle: a block cannot contain itself, and two expressions cannot read each other.");
        break;
      default:
        break; // the validator's own message is already the whole story
    }
  }
  return out;
}

/** Every `on` handler as a flat list of actions. */
function actionsOf(doc: KageDoc): { id: string; event: string; action: Record<string, unknown> }[] {
  const out: { id: string; event: string; action: Record<string, unknown> }[] = [];
  for (const [id, b] of Object.entries(doc.blocks))
    for (const [event, h] of Object.entries(b.on && typeof b.on === "object" ? b.on : {})) for (const a of Array.isArray(h) ? h : [h]) if (a && typeof a === "object") out.push({ id, event, action: a as unknown as Record<string, unknown> });
  return out;
}

/** Every expression-bearing value in a block, with its JSON pointer. */
function exprsOf(id: string, b: Block): { at: string; value: unknown }[] {
  const base = "/blocks/" + id;
  return [{ at: base + "/props", value: b.props }, { at: base + "/bind", value: b.bind }, { at: base + "/visible", value: b.visible }, { at: base + "/on", value: b.on }, { at: base + "/repeat", value: b.repeat }].filter((e) => e.value !== undefined);
}

const CHARTS = new Set(["area-chart", "donut-chart", "heatmap", "combo-chart", "stacked-bar-chart", "funnel-chart", "treemap", "sankey", "map", "bar-chart", "line-chart", "scatter-chart"]);
const SELECTABLE = new Set(["donut-chart", "heatmap", "funnel-chart", "treemap", "map"]);
const DATA_PROP: Record<string, string> = { "area-chart": "items", "donut-chart": "items", "heatmap": "values", "combo-chart": "series", "stacked-bar-chart": "series", "funnel-chart": "stages", "treemap": "items", "sankey": "links", "map": "features", "bar-chart": "items", "line-chart": "items", "scatter-chart": "items" };

/** Pitfalls a valid document can still have. Each finding names the block and a fix. */
export function lint(doc: KageDoc, override?: string): Advice[] {
  const out: Advice[] = [];
  const system = override ?? systemOf(doc);
  const add = (at: string, code: string, msg: string, fix?: string) => out.push({ level: "lint", at, code, msg, ...(fix ? { fix } : {}) });
  // Documents are untrusted: tolerate anything shaped wrongly rather than throw,
  // since lint runs on drafts an agent is still assembling.
  const raw = doc && typeof doc.blocks === "object" && doc.blocks ? doc.blocks : {};
  const blocks: KageDoc["blocks"] = Object.fromEntries(Object.entries(raw).filter(([, b]) => b && typeof b === "object"));
  doc = { ...doc, blocks };
  const actions = actionsOf(doc);
  const reads = new Set<string>(); // "block.output" strings that something reads
  const stateKeys = new Set(Object.keys(doc.state ?? {}));
  const handled = new Set(actions.map((a) => a.id + ":" + a.event));

  // Pass 1: what is read anywhere, so a rule about block A can see a read in block Z.
  for (const [id, b] of Object.entries(blocks)) {
    for (const { at, value } of exprsOf(id, b)) {
      walkExpr(value as never, (op, arg) => {
        if (op === "$block") reads.add(String(arg));
        if (op === "$tpl" && typeof arg === "string") {
          for (const m of arg.matchAll(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g)) {
            const [, ns, path] = m;
            if (ns === "block") {
              reads.add(path);
              const [bid, ...rest] = path.split("."), tgt = blocks[bid];
              if (!tgt) add(at, "tpl-missing-block", `A template reads \`{{block.${path}}}\` but there is no block \`${bid}\`.`, `Fix the id or add the block.`);
              else {
                const outs = resolve(system, tgt.type).contract?.outputs ?? [];
                if (outs.length && !outs.includes(rest[0])) add(at, "tpl-private-read", `A template reads \`{{block.${path}}}\`, but \`${rest[0]}\` is not an output of ${tgt.type} (outputs: ${list(outs)}); it renders empty.`, "Read a declared output, or store the value in state and use {{state.key}}.");
              }
            } else if (ns === "state" && stateKeys.size && !stateKeys.has(path.split(".")[0])) {
              const guess = nearest(path.split(".")[0], [...stateKeys]);
              add(at, "tpl-undeclared-state", `A template reads \`{{state.${path}}}\`, but that state key is not declared; it renders empty.`, guess ? `Did you mean \`${guess}\`?` : `Declare it in \`state\`.`);
            }
          }
        }
      });
    }
  }

  // Pass 2: per-block pitfalls.
  for (const [id, b] of Object.entries(blocks)) {
    const p = (b.props ?? {}) as Record<string, unknown>, base = "/blocks/" + id;

    if (b.type === "button" && !handled.has(id + ":click")) add(base, "dead-button", `Button \`${id}\` has no click handler, so pressing it does nothing.`, `Add on.click, for example [{"do":"set","path":"…","value":…}] or a call to another block's command.`);
    if (b.type === "form" && !handled.has(id + ":submit")) add(base, "form-unwired", `Form \`${id}\` has no submit handler; submitted values are discarded.`, `Add on.submit: [{"do":"set","path":"submitted","value":{"$event":"values"}}] and declare that state key.`);
    if (b.type === "modal" && !actions.some((a) => a.action.do === "call" && a.action.target === id && (a.action.command === "open" || a.action.command === "toggle")) && b.visible === undefined)
      add(base, "modal-unreachable", `Modal \`${id}\` is never opened: nothing calls its \`open\` command.`, `Give a button on.click: [{"do":"call","target":"${id}","command":"open"}].`);
    if (b.type === "toc") for (const [i, it] of (Array.isArray(p.items) ? p.items : []).entries()) {
      const target = String((it as { target?: unknown })?.target ?? "");
      if (!Object.values(blocks).some((x) => x.type === "anchor" && String((x.props as { name?: unknown })?.name ?? "") === target)) add(`${base}/props/items/${i}`, "toc-missing-anchor", `The outline links to \`${target}\`, but no anchor block has that name; the link goes nowhere.`, `Add {"type":"anchor","props":{"name":"${target}"}} before the heading.`);
    }
    if (b.type === "tab-panel") {
      const n = Array.isArray(p.tabs) ? p.tabs.length : 0, used = Object.keys(b.slots ?? {}).filter((s) => /^panel\d$/.test(s) && (b.slots![s] ?? []).length);
      for (const s of used) if (Number(s.slice(5)) > n) add(`${base}/slots/${s}`, "tab-panel-extra-slot", `\`${s}\` has content but there are only ${n} tab(s); it will never show.`, "Add a tab for it or move the blocks.");
      for (let i = 1; i <= Math.min(n, 6); i++) if (!used.includes("panel" + i)) add(`${base}/slots/panel${i}`, "tab-panel-empty", `Tab ${i} has no blocks in \`panel${i}\`; it will open to an empty panel.`, `Put blocks in slots.panel${i}.`);
    }
    for (const [k, v] of Object.entries(p)) if (Array.isArray(v) && v.length > 1 && v.every((x) => x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string")) {
      const ids = (v as { id: string }[]).map((x) => x.id), dup = ids.find((x, i) => ids.indexOf(x) !== i);
      if (dup !== undefined) add(`${base}/props/${k}`, "duplicate-item-id", `\`${k}\` of \`${id}\` repeats the id "${dup}"; selecting one will select both.`, "Give each item a unique id.");
    }
    if ((b.type === "video" || b.type === "audio") && typeof p.src === "string" && /^http:\/\//i.test(p.src)) add(`${base}/props/src`, "insecure-media", `\`${id}\` uses an http:// source; media must be https or a local path, so it will not play.`, "Use the https:// URL.");
    if (b.type === "gallery") for (const [i, it] of (Array.isArray(p.items) ? p.items : []).entries()) if (typeof (it as { src?: unknown })?.src === "string" && /^http:\/\//i.test((it as { src: string }).src)) add(`${base}/props/items/${i}/src`, "insecure-media", `Gallery image ${i + 1} uses http://; only https or local images render.`, "Use the https:// URL.");
    if (CHARTS.has(b.type)) {
      const key = DATA_PROP[b.type];
      if (Array.isArray(p[key]) && (p[key] as unknown[]).length === 0 && !(b.bind && key in b.bind)) add(`${base}/props/${key}`, "empty-chart", `\`${id}\` (${b.type}) has an empty \`${key}\` and no binding, so it will only show "No data".`, `Provide ${key} or bind.${key} from data/state.`);
      if (SELECTABLE.has(b.type) && p.interactive === true && !handled.has(id + ":select") && ![...reads].some((r) => r.split(".")[0] === id)) add(base, "selection-unused", `\`${id}\` is interactive but nothing reads its selection, so clicking it changes nothing visible.`, `Read {"$block":"${id}.selected"} in another block's bind, or add on.select.`);
    }
    if (b.type === "calendar" && typeof p.month === "string" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) && !(b.bind && "month" in b.bind)) add(`${base}/props/month`, "calendar-month", `\`${id}\` has month "${p.month}"; it must look like 2026-03, otherwise the calendar shows an error.`, 'Use "YYYY-MM".');
  }

  // Blocks no slot leads to are leftovers: harmless to the validator, invisible to readers.
  const reach = new Set<string>();
  const visit = (id: string) => { if (reach.has(id) || !blocks[id]) return; reach.add(id); for (const kids of Object.values(blocks[id].slots ?? {})) if (Array.isArray(kids)) kids.forEach(visit); };
  if (doc.root) visit(doc.root);
  const referenced = new Set<string>(); for (const r of reads) referenced.add(r.split(".")[0]); for (const a of actions) if (typeof a.action.target === "string") referenced.add(a.action.target);
  for (const id of Object.keys(blocks)) if (!reach.has(id) && !referenced.has(id)) add("/blocks/" + id, "unreachable-block", `Block \`${id}\` is not placed in any slot under the root, so it never renders.`, `Add "${id}" to a slot, or delete the block.`);
  return out;
}

/** Validation plus advice and lint in one call: what adapters return. */
export function review(doc: KageDoc, override?: string): ValidateResult & { advice: Advice[] } {
  const result = validate(doc, override);
  return { ...result, advice: [...advise(doc, result), ...lint(doc, override)] };
}
