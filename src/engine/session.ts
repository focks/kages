// A headless Kage session: the renderer's state machine without React. It holds
// the live app state and per-block local state, resolves any block's outputs,
// and dispatches events through the same defaults→handlers transaction the
// visual runtime uses. The React <KageRenderer> is a thin view over exactly
// this; keeping the logic here means the oracle's interaction flow (pick a
// region, type a filter, reset, toggle) is testable in Node with no DOM, and
// the renderer can never drift from it. See oracle/actions-runtime.feature.

import { resolve } from "./resolve.ts";
import { evaluate, clone, merge } from "./expr.ts";
import { initLocals, makeCtx, materialize, runActions, systemOf, type LogEntry, type RuntimeCtx, type Draft } from "./runtime-core.ts";
import type { KageDoc, Json } from "./types.ts";

export class KageSession {
  readonly sysId: string;
  // Parameter-property shorthand (`constructor(private doc)`) is avoided on
  // purpose: Node's native type-stripping can't emit the field assignment it
  // implies, and this package runs under `node --test` with no compile step.
  private doc: KageDoc;
  private state: Record<string, Json>;
  private locals: Record<string, Record<string, Json>>;
  log: LogEntry[] = [];
  private expanded?: KageDoc;
  private context?: RuntimeCtx;

  constructor(doc: KageDoc, system?: string) {
    this.doc = doc;
    this.sysId = systemOf(doc, system);
    this.state = clone(doc.state || {});
    this.locals = initLocals(doc, this.sysId);
  }

  /** The current app state (a copy — callers never hold a live reference). */
  getState(): Record<string, Json> {
    return clone(this.state);
  }

  /** Resolve current instances after state changes; retained locals survive
   * filtering and reordering because identity follows the item key. */
  instances(): KageDoc {
    return clone(this.currentDoc());
  }

  private currentDoc(): KageDoc {
    return this.expanded ??= materialize(this.doc, this.sysId, this.state, this.locals);
  }

  private currentContext(): RuntimeCtx {
    const doc = this.currentDoc();
    return this.context ??= makeCtx(doc, this.sysId, this.state, { ...initLocals(doc, this.sysId), ...this.locals });
  }

  /** A block's resolved outputs right now: contract defaults → local → props → bind. */
  read(id: string): Record<string, Json> | undefined {
    return clone(this.currentContext().output(id));
  }

  /** Whether a block's `visible` expression holds now (absent visible = shown). */
  visible(id: string): boolean {
    const doc = this.currentDoc();
    const b = doc.blocks[id];
    if (!b || b.visible === undefined) return true;
    const ctx = merge(this.currentContext(), { self: id });
    return !!evaluate(b.visible, ctx);
  }

  /** Fire an event on a block. Runs the contract's defaults first, then the
   *  block's own handlers, all onto one draft; commits only if nothing threw,
   *  so a failed handler leaves state untouched (the transaction invariant).
   *  Returns the log of host actions / errors from this dispatch. */
  dispatch(id: string, event: string, payload: Json = {}): LogEntry[] {
    const doc = this.currentDoc();
    const b = doc.blocks[id];
    if (!b) throw new Error("dispatch: no block '" + id + "'");
    const r = resolve(this.sysId, b.type);
    if (!r.contract) throw new Error("dispatch: unresolved block '" + id + "'");
    const draft: Draft = { state: clone(this.state), locals: { ...initLocals(doc, this.sysId), ...clone(this.locals) } };
    const log: LogEntry[] = [];
    runActions(doc, this.sysId, r.contract.defaults[event], draft, id, payload, log);
    runActions(doc, this.sysId, (b.on || {})[event], draft, id, payload, log);
    this.state = draft.state;
    this.locals = draft.locals;
    this.expanded = undefined; this.context = undefined;
    this.log = log.concat(this.log).slice(0, 50);
    return log;
  }
}
