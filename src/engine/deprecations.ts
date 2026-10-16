// Deprecated means absent, for authoring. A retired prop, role, enum value or
// document field should not steer new work, even though stored versions keep
// rendering with the contract they pinned. This module is the mechanism only: the
// registry, a detector, and a pure migration planner. It deprecates nothing by
// itself: REGISTRY is empty until someone makes that product decision.
//
// To deprecate something: add an entry below (stable id, since, reason, replacement
// and a migration), a fixture-backed test, and a line in the changelog.
import type { Block, KageDoc } from "./types.ts";

export type DeprecationKind = "prop" | "role" | "enum-value" | "doc-field";

export interface Deprecation {
  /** Stable forever: policies, waivers and logs refer to it. */
  id: string;
  kind: DeprecationKind;
  /** The role (block type) it concerns, or for doc-field the dotted path ("meta.legacy"). */
  target: { role?: string; ref?: string; docField?: string };
  prop?: string;
  value?: string;
  since: string;
  /** Informational only; never parsed for logic. */
  removeIn?: string;
  reason: string;
  replacement: { prop?: string; role?: string } | null;
  migration?: { op: "rename-prop" | "remove-prop" | "map-value" | "change-role" | "remove-field"; to?: string; map?: Record<string, string> };
  /** Pure renames and removals only. false = a person or agent has to decide. */
  auto: boolean;
}

export const REGISTRY: readonly Deprecation[] = [];

export interface Usage { entry: Deprecation; at: string; block?: string; detail: string }
export interface MigrationOp { op: "add" | "remove" | "replace" | "move"; path: string; value?: unknown; from?: string }
export interface ManualStep { entry: Deprecation; at: string; message: string }

const roleOf = (e: Deprecation): string | undefined => e.target.role ?? (e.target.ref ? e.target.ref.split("/").pop()?.split("@")[0] : undefined);
const esc = (s: string) => s.replace(/~/g, "~0").replace(/\//g, "~1");

function docFieldValue(doc: unknown, path: string): { found: boolean } {
  let cur: unknown = doc;
  for (const part of path.split(".")) {
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, part)) return { found: false };
    cur = (cur as Record<string, unknown>)[part];
  }
  return { found: true };
}

/** Every use of a deprecated thing in a document. Bound props count: `bind.x` is a use of `x`. */
export function findDeprecated(doc: KageDoc, entries: readonly Deprecation[] = REGISTRY): Usage[] {
  const out: Usage[] = [];
  const blocks = doc && typeof doc.blocks === "object" && doc.blocks ? doc.blocks : {};
  for (const e of entries) {
    if (e.kind === "doc-field") {
      const path = e.target.docField ?? "";
      if (path && docFieldValue(doc, path).found) out.push({ entry: e, at: "/" + path.split(".").map(esc).join("/"), detail: `the document field \`${path}\`` });
      continue;
    }
    const role = roleOf(e);
    if (!role) continue;
    for (const [id, raw] of Object.entries(blocks)) {
      const b = raw as Block | null;
      if (!b || typeof b !== "object" || b.type !== role) continue;
      const base = "/blocks/" + id;
      if (e.kind === "role") out.push({ entry: e, at: base, block: id, detail: `the role \`${role}\`` });
      else if (e.kind === "prop" && e.prop) {
        if (b.props && e.prop in b.props) out.push({ entry: e, at: `${base}/props/${esc(e.prop)}`, block: id, detail: `\`${role}.${e.prop}\`` });
        if (b.bind && e.prop in b.bind) out.push({ entry: e, at: `${base}/bind/${esc(e.prop)}`, block: id, detail: `a binding to \`${role}.${e.prop}\`` });
      } else if (e.kind === "enum-value" && e.prop && e.value !== undefined && b.props && (b.props as Record<string, unknown>)[e.prop] === e.value)
        out.push({ entry: e, at: `${base}/props/${esc(e.prop)}`, block: id, detail: `\`${role}.${e.prop}: ${e.value}\`` });
    }
  }
  return out;
}

/** What to do about it. Automatic entries become patch ops; the rest name the replacement for a human or agent. */
export function planMigration(doc: KageDoc, entries: readonly Deprecation[] = REGISTRY): { patch: MigrationOp[]; manual: ManualStep[]; ids: string[] } {
  const patch: MigrationOp[] = [], manual: ManualStep[] = [], ids = new Set<string>();
  const blocks = (doc?.blocks ?? {}) as Record<string, Block>;
  for (const u of findDeprecated(doc, entries)) {
    const e = u.entry, m = e.migration;
    const hint = e.replacement ? ` Use ${e.replacement.prop ? "`" + e.replacement.prop + "`" : "`" + e.replacement.role + "`"} instead.` : "";
    const needsPerson = (why: string) => manual.push({ entry: e, at: u.at, message: `${u.detail} is deprecated: ${e.reason}${hint} ${why}`.trim() });
    if (!e.auto || !m) { needsPerson("This needs a decision."); continue; }
    const id = u.block;
    switch (m.op) {
      case "rename-prop": {
        if (!id || !m.to) { needsPerson("The migration has no target."); break; }
        const b = blocks[id], inBind = u.at.includes("/bind/"), bag = (inBind ? b.bind : b.props) as Record<string, unknown> | undefined;
        if (bag && m.to in bag) { needsPerson(`\`${m.to}\` is already set on this block.`); break; }
        patch.push({ op: "move", from: u.at, path: u.at.replace(/[^/]+$/, esc(m.to)) });
        ids.add(e.id); break;
      }
      case "remove-prop": patch.push({ op: "remove", path: u.at }); ids.add(e.id); break;
      case "remove-field": patch.push({ op: "remove", path: u.at }); ids.add(e.id); break;
      case "map-value": {
        const cur = id && e.prop ? (blocks[id].props as Record<string, unknown>)[e.prop] : undefined;
        const to = typeof cur === "string" ? m.map?.[cur] : undefined;
        if (to === undefined) { needsPerson("There is no mapping for this value."); break; }
        patch.push({ op: "replace", path: u.at, value: to }); ids.add(e.id); break;
      }
      case "change-role": {
        if (!id || !m.to) { needsPerson("The migration has no target role."); break; }
        patch.push({ op: "replace", path: `/blocks/${id}/type`, value: m.to }); ids.add(e.id); break;
      }
    }
  }
  return { patch, manual, ids: [...ids].sort() };
}

/** "Do not use" lines for packs and the context. Empty while nothing is deprecated. */
export function doNotUse(entries: readonly Deprecation[] = REGISTRY): string[] {
  return entries.map((e) => `${e.kind === "doc-field" ? e.target.docField : [roleOf(e), e.prop, e.value].filter(Boolean).join(".")}: ${e.reason}${e.replacement ? ` Use ${e.replacement.prop ?? e.replacement.role}.` : ""} (since ${e.since})`);
}
