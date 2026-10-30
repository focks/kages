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
import { resolve } from "./resolve.ts";
import { systems } from "./data.ts";
import { validate, validateDocument } from "./validate.ts";
import { buildContext } from "./rules/context.ts";
import type { Deprecation } from "./deprecations.ts";
import { RULES, ruleById } from "./rules/index.ts";
import { nearest, list } from "./rules/text.ts";
import type { Rule, Severity, Tier } from "./rules/types.ts";
import type { Block, KageDoc, ValidateResult } from "./types.ts";

export { nearest };

export interface Advice {
  /** "hint" explains a validator finding; "lint" flags a pitfall the validator allows. */
  level: "hint" | "lint";
  at: string;
  code: string;
  msg: string;
  /** What to change, in one sentence an agent can act on. */
  fix?: string;
  /** Lint findings carry their rule's id, severity and tier (hints do not). */
  rule?: string;
  severity?: Severity;
  tier?: Tier;
}

const blockOf = (doc: KageDoc, at: string): { id: string; block: Block } | undefined => {
  const id = /^\/blocks\/([^/]+)/.exec(at)?.[1];
  const block = id && doc.blocks && Object.prototype.hasOwnProperty.call(doc.blocks, id) ? doc.blocks[id] : undefined;
  return id && block && typeof block === "object" ? { id, block } : undefined;
};

/** One fix per validator finding, from the document and the installed contracts. */
export function advise(doc: KageDoc, result: ValidateResult): Advice[] {
  const out: Advice[] = [];
  const system = result.system;
  const roles = Object.keys(systems[system]?.components ?? {});
  const stateKeys = Object.keys(doc.state ?? {});
  const blockIds = Object.keys(doc.blocks && typeof doc.blocks === "object" ? doc.blocks : {});
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
      case "missing-key": {
        const need = /`([^`]+)`/.exec(f.msg)?.[1] ?? "";
        hint(f, f.msg, `Add "${need}" to this item, or run \`kages contract ${contract?.ref ?? "<ref>"}\` to see the item shape.`);
        break;
      }
      case "type":
      case "enum":
        hint(f, f.msg, `Change ${f.at} to match, or bind it with bind.${key} if the value is computed.`);
        break;
      case "bad-id":
        hint(f, f.msg, "Rename the block: start with a lowercase letter, then use letters, digits, - or _ (48 characters at most).");
        break;
      case "bad-kage-id":
        hint(f, f.msg, `Set /id to a slug such as "quarterly-report".`);
        break;
      case "missing-root":
        hint(f, f.msg, blockIds.length ? `Set /root to the outermost block, one of: ${list(blockIds.slice(0, 12))}.` : "Add at least one block under `blocks`, then set /root to its id.");
        break;
      case "unknown-system":
        hint(f, f.msg, `Use one of: ${list(Object.keys(systems))}.`);
        break;
      case "bad-expr":
        hint(f, f.msg, "Reshape the operator's argument as the message says; see `kages schema <system>`.");
        break;
      case "missing-data": {
        const k = /'([^'.]+)/.exec(f.msg)?.[1] ?? "", guess = nearest(k, Object.keys(doc.data ?? {}));
        hint(f, f.msg, guess ? `Did you mean \`${guess}\`?` : `Add "${k}" under \`data\`.`);
        break;
      }
      case "bad-path":
      case "missing-field":
      case "foreign-local":
      case "bad-watch":
      case "bad-shape":
        hint(f, f.msg, `Correct ${f.at} as described.`);
        break;
      case "orphan":
        hint(f, f.msg, "Place it in a parent's slot, or delete it.");
        break;
      case "bad-expansion":
        hint(f, f.msg, "Check `repeat.each` yields a list with unique keys, and that compositions do not include themselves.");
        break;
      case "eval-budget":
        hint(f, f.msg, "Reduce nested $map, or compute the result ahead of time and store it under `data`.");
        break;
      case "unknown-key": {
        const allowed = f.at.startsWith("/blocks/") ? ["type", "props", "bind", "slots", "on", "watch", "visible", "repeat", "meta"] : ["title", "system", "root", "blocks", "state", "data", "sources", "compositions", "design", "brief", "meta"];
        const guess = nearest(key, allowed);
        hint(f, f.msg, key === "children" ? "Put child block ids under `slots.children`." : guess ? `Rename it to \`${guess}\`.` : "Remove it.");
        break;
      }
      case "unknown-operator":
        hint(f, f.msg, `Use a real operator; see \`kages schema ${system}\`.`);
        break;
      case "item-shape":
        hint(f, f.msg, `Run \`kages contract ${contract?.ref ?? "<ref>"}\` to see the item shape.`);
        break;
      case "set-without-value":
        hint(f, f.msg, "Add `value` to the action.");
        break;
      default:
        break; // the validator's own message is already the whole story
    }
  }
  return out;
}

/** Pitfalls a valid document can still have. Each finding names the block and a
 *  fix. The rules themselves live in ./rules; this is the thin pipeline over them. */
export function lint(doc: KageDoc, override?: string): Advice[] {
  return lintDetailed(doc, { system: override }).findings;
}

export interface LintOptions {
  system?: string;
  /** Run only one tier; omitted = every rule. */
  tier?: Tier;
  /** Workspace-level rule ids that never report (config `lint.ignoreRules`). */
  ignoreRules?: readonly string[];
  /** The workspace brief's `absent` list: raises the severity of a claim it names. */
  absent?: readonly string[];
  /** The deprecation registry to check against (default: the shipped one). */
  deprecations?: readonly Deprecation[];
  /** Rules to run instead of the registry; for tests and embedders. */
  rules?: readonly Rule[];
  /** Per-rule severity overrides (config `lint.severity`). */
  severity?: Readonly<Record<string, Severity>>;
}

export interface LintReport {
  findings: Advice[];
  /** Findings removed by a waiver, kept so the audit log and doctor can count them. */
  waived: Advice[];
  /** Rule ids that actually ran. */
  ran: string[];
}

interface Waiver { rule: string; block?: string; reason: string }
const SEV: Record<Severity, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
const MIN_REASON = 8;

function waiversOf(doc: KageDoc, out: Advice[]): Waiver[] {
  const raw = ((doc?.meta as { kages?: { lint?: { ignore?: unknown } } } | undefined)?.kages?.lint?.ignore);
  if (raw === undefined) return [];
  const bad = (i: number, msg: string, fix: string) => out.push({ level: "lint", at: `/meta/kages/lint/ignore/${i}`, code: "bad-waiver", rule: "bad-waiver", severity: "P3", tier: "immediate", msg, fix });
  if (!Array.isArray(raw)) { bad(0, "`meta.kages.lint.ignore` must be a list of {rule, block?, reason}.", "Make it an array."); return []; }
  const ok: Waiver[] = [];
  raw.forEach((w, i) => {
    const x = w as Partial<Waiver> | null;
    if (!x || typeof x.rule !== "string") return bad(i, "A lint waiver needs a `rule`.", "Name the rule id to waive.");
    if (!ruleById(x.rule)) return bad(i, `The waiver names an unknown rule \`${x.rule}\`.`, "Use an id from `kages lint --list`.");
    if (typeof x.reason !== "string" || x.reason.trim().length < MIN_REASON) return bad(i, `The waiver for \`${x.rule}\` needs a reason of at least ${MIN_REASON} characters.`, "Say why this finding is acceptable here; a waiver without a reason is just silence.");
    ok.push({ rule: x.rule, ...(typeof x.block === "string" ? { block: x.block } : {}), reason: x.reason });
  });
  return ok;
}

/** Run the registry, apply waivers, and return findings sorted by severity then
 *  location. Deterministic: same document, same ordered output. */
export function lintDetailed(doc: KageDoc, opts: LintOptions = {}): LintReport {
  const ctx = buildContext(doc, opts.system, opts.deprecations, opts.absent);
  const findings: Advice[] = [], waived: Advice[] = [], ran: string[] = [];
  const meta: Advice[] = [];
  const waivers = waiversOf(ctx.doc, meta);
  const ignored = new Set(opts.ignoreRules ?? []);
  for (const rule of opts.rules ?? RULES) {
    if (opts.tier && rule.tier !== opts.tier) continue;
    if (rule.modes && (!ctx.mode || !rule.modes.includes(ctx.mode))) continue;
    if (ignored.has(rule.id)) continue;
    ran.push(rule.id);
    const ruleSeverity = opts.severity?.[rule.id] ?? rule.severity;
    for (const f of rule.check(ctx)) {
      const severity = opts.severity?.[rule.id] ?? f.severity ?? ruleSeverity;
      const advice: Advice = { level: "lint", at: f.at, code: rule.id, msg: f.msg, ...(f.fix ? { fix: f.fix } : {}), rule: rule.id, severity, tier: rule.tier };
      const block = f.at.startsWith("/blocks/") ? f.at.split("/")[2] : undefined;
      const hit = waivers.some((w) => w.rule === rule.id && (w.block === undefined || w.block === block));
      (hit ? waived : findings).push(advice);
    }
  }
  findings.push(...meta);
  const order = (a: Advice, b: Advice) => SEV[a.severity ?? "P3"] - SEV[b.severity ?? "P3"] || (a.at < b.at ? -1 : a.at > b.at ? 1 : 0) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
  return { findings: findings.sort(order), waived: waived.sort(order), ran };
}

/** Validation plus advice and lint in one call: what adapters return. */
export function review(doc: KageDoc, override?: string): ValidateResult & { advice: Advice[] } {
  const result = validate(doc, override);
  return { ...result, advice: [...advise(doc, result), ...lint(doc, override)] };
}

/** review(), judged the way a write will be: what validate_kage and `kages validate` report,
 *  so a document they pass is one create_kage accepts. review() itself stays pinned to the oracle. */
export function reviewDocument(doc: KageDoc, override?: string): ValidateResult & { advice: Advice[] } {
  const result = validateDocument(doc, override);
  return { ...result, advice: [...advise(doc, result), ...lint(doc, override)] };
}
