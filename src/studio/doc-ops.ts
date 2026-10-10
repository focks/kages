// Pure structural edits for the studio. Every function takes a KageDoc and
// returns a NEW one (never mutates) — add/duplicate/move/group/delete blocks,
// plus docDiff which turns "old doc → new doc" into the minimal RFC6902 patch
// the store persists. Keeping this layer pure and framework-free is what lets
// the visual editor, the raw-JSON editor and (later) the agent all share one
// set of correct operations, and lets a single node:test file guard them.
//
// Relative imports (not @/) so `node --test` can type-strip this without the
// Next alias resolver. See .claude/skills/testing-conventions.

import { resolve, systemOf } from "../engine/resolve.ts";
import { clone } from "../engine/expr.ts";
import { applyPatch, type PatchOp } from "../collab/patch.ts";
import type { KageDoc, Block } from "../engine/types.ts";

/** Where a block sits: its parent, which slot, and its index in that slot. */
export interface Loc { parentId: string; slot: string; index: number; }

/** Scan the tree for the block that holds `id` in one of its slots. Null for
 *  the root or an orphan. O(blocks × slots) — fine at authoring scale. */
export function parentOf(doc: KageDoc, id: string): Loc | null {
  for (const parentId of Object.keys(doc.blocks)) {
    const slots = doc.blocks[parentId].slots || {};
    for (const slot of Object.keys(slots)) {
      const index = slots[slot].indexOf(id);
      if (index >= 0) return { parentId, slot, index };
    }
  }
  return null;
}

/** `id` plus every block reachable through its slots (its subtree). */
export function subtree(doc: KageDoc, id: string, acc = new Set<string>()): Set<string> {
  acc.add(id);
  const slots = doc.blocks[id]?.slots || {};
  for (const slot of Object.keys(slots)) for (const cid of slots[slot]) if (!acc.has(cid)) subtree(doc, cid, acc);
  return acc;
}

function slugify(base: string): string {
  let s = (base || "block").toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!/^[a-z]/.test(s)) s = "b" + (s ? "-" + s : "");
  return s.slice(0, 48) || "block";
}

/** A fresh id derived from `base`, unique against `taken`. Suffixes -2, -3… */
function uniqueId(taken: Set<string>, base: string): string {
  const slug = slugify(base);
  if (!taken.has(slug)) return slug;
  for (let i = 2; ; i++) { const cand = slug.slice(0, 45) + "-" + i; if (!taken.has(cand)) return cand; }
}

export function newId(doc: KageDoc, base: string): string {
  return uniqueId(new Set(Object.keys(doc.blocks)), base);
}

/** Append a new block of `type` into `parentId`'s `slot`, seeded with its
 *  contract's prop defaults. Required props without a default are left unset so
 *  the Problems bar points the author at exactly what to fill. */
export function addBlock(doc: KageDoc, parentId: string, slot: string, type: string): KageDoc {
  const r = resolve(systemOf(doc), type);
  if (!r.contract) throw new Error(r.error);
  const id = newId(doc, r.contract.role || type.split("/").pop()!.split("@")[0]);
  const props: Record<string, unknown> = {};
  for (const [k, spec] of Object.entries(r.contract.props)) if (spec.default !== undefined) props[k] = spec.default;
  const block: Block = { type };
  if (Object.keys(props).length) block.props = props as Block["props"];

  const parent = doc.blocks[parentId];
  const ops: PatchOp[] = [{ op: "add", path: `/blocks/${id}`, value: clone(block) as never }];
  // The slot array may not exist yet — RFC6902 add needs its parent present, so
  // create the slots object / the slot array before appending into it.
  if (!parent.slots) ops.push({ op: "add", path: `/blocks/${parentId}/slots`, value: { [slot]: [id] } as never });
  else if (!parent.slots[slot]) ops.push({ op: "add", path: `/blocks/${parentId}/slots/${slot}`, value: [id] as never });
  else ops.push({ op: "add", path: `/blocks/${parentId}/slots/${slot}/-`, value: id as never });
  return applyPatch(doc, ops);
}

/** Deep-clone a block and its subtree with fresh ids, inserted right after the
 *  original. `$block`/`$state` references inside are left pointing at the
 *  originals — a duplicate reads the same wires until the author rewires it. */
export function duplicateBlock(doc: KageDoc, id: string): KageDoc {
  const at = parentOf(doc, id);
  if (!at) throw new Error("cannot duplicate the root block");
  const ids = [...subtree(doc, id)];
  const taken = new Set(Object.keys(doc.blocks));
  const remap: Record<string, string> = {};
  for (const old of ids) { const nid = uniqueId(taken, old); taken.add(nid); remap[old] = nid; }

  const ops: PatchOp[] = [];
  for (const old of ids) {
    const nb = clone(doc.blocks[old]);
    if (nb.slots) {
      const ns: Record<string, string[]> = {};
      for (const s of Object.keys(nb.slots)) ns[s] = nb.slots[s].map((c) => remap[c] ?? c);
      nb.slots = ns;
    }
    ops.push({ op: "add", path: `/blocks/${remap[old]}`, value: nb as never });
  }
  ops.push({ op: "add", path: `/blocks/${at.parentId}/slots/${at.slot}/${at.index + 1}`, value: remap[id] as never });
  return applyPatch(doc, ops);
}

/** Remove a block, its subtree, and its entry in the parent slot. */
export function deleteBlock(doc: KageDoc, id: string): KageDoc {
  if (id === doc.root) throw new Error("cannot delete the root block");
  const at = parentOf(doc, id);
  const ops: PatchOp[] = [];
  // Remove the slot reference first (by index), then the block records.
  if (at) ops.push({ op: "remove", path: `/blocks/${at.parentId}/slots/${at.slot}/${at.index}` });
  for (const bid of subtree(doc, id)) ops.push({ op: "remove", path: `/blocks/${bid}` });
  return applyPatch(doc, ops);
}

/** Move `id` to `index` in `toParent`/`toSlot`. `index` is the insertion point
 *  in the destination slot AFTER `id` is removed from its source — the natural
 *  "drop before sibling k" semantics. Done functionally (not an RFC6902 move) so
 *  same-slot reordering has no index-shift ambiguity. */
export function moveBlock(doc: KageDoc, id: string, toParent: string, toSlot: string, index: number): KageDoc {
  if (id === doc.root) throw new Error("cannot move the root block");
  if (subtree(doc, id).has(toParent)) throw new Error("cannot move a block into its own subtree");
  const from = parentOf(doc, id);
  if (!from) throw new Error("block has no parent");

  const blocks = { ...doc.blocks };
  // Detach from source (immutably).
  const src = blocks[from.parentId];
  const srcSlots = { ...(src.slots || {}) };
  srcSlots[from.slot] = srcSlots[from.slot].filter((c) => c !== id);
  blocks[from.parentId] = { ...src, slots: srcSlots };
  // Attach to destination — read from the already-updated map so a same-parent
  // move sees the post-detach array.
  const dst = blocks[toParent];
  const dstSlots = { ...(dst.slots || {}) };
  const arr = [...(dstSlots[toSlot] || [])];
  arr.splice(Math.max(0, Math.min(index, arr.length)), 0, id);
  dstSlots[toSlot] = arr;
  blocks[toParent] = { ...dst, slots: dstSlots };
  return { ...doc, blocks };
}

/** Wrap sibling blocks (same parent + slot) in a new container, in place. */
export function groupBlocks(doc: KageDoc, ids: string[], container = "stack"): KageDoc {
  if (!ids.length) throw new Error("nothing to group");
  const locs = ids.map((id) => parentOf(doc, id));
  if (locs.some((l) => !l)) throw new Error("cannot group the root block");
  const { parentId, slot } = locs[0]!;
  if (locs.some((l) => l!.parentId !== parentId || l!.slot !== slot)) throw new Error("can only group siblings in the same slot");

  const r = resolve(systemOf(doc), container);
  if (!r.contract) throw new Error(r.error);
  const slotName = r.contract.slots.children ? "children" : Object.keys(r.contract.slots)[0];
  if (!slotName) throw new Error(`'${container}' has no slot to group into`);

  const gid = newId(doc, container);
  const slotArr = doc.blocks[parentId].slots![slot];
  const ordered = slotArr.filter((c) => ids.includes(c)); // keep visual order
  const remaining = slotArr.filter((c) => !ids.includes(c));
  const before = slotArr.slice(0, slotArr.indexOf(ordered[0])).filter((c) => !ids.includes(c)).length;
  const newArr = [...remaining.slice(0, before), gid, ...remaining.slice(before)];

  const blocks = { ...doc.blocks };
  blocks[gid] = { type: container, slots: { [slotName]: ordered } };
  blocks[parentId] = { ...blocks[parentId], slots: { ...blocks[parentId].slots, [slot]: newArr } };
  return { ...doc, blocks };
}

/** Minimal RFC6902 patch turning `oldDoc` into `newDoc`, diffed per block (so
 *  the store's block-level claims and three-way merge still apply) plus the
 *  top-level fields the studio can change. This is the Save payload, and the
 *  one bridge both the visual and JSON editors feed into. */
export function docDiff(oldDoc: KageDoc, newDoc: KageDoc): PatchOp[] {
  const ops: PatchOp[] = [];
  const o = oldDoc.blocks || {}, n = newDoc.blocks || {};
  for (const id of Object.keys(n)) {
    if (!(id in o)) ops.push({ op: "add", path: `/blocks/${id}`, value: clone(n[id]) as never });
    else if (JSON.stringify(o[id]) !== JSON.stringify(n[id])) ops.push({ op: "replace", path: `/blocks/${id}`, value: clone(n[id]) as never });
  }
  for (const id of Object.keys(o)) if (!(id in n)) ops.push({ op: "remove", path: `/blocks/${id}` });

  for (const key of ["title", "system", "root"] as const)
    if (oldDoc[key] !== newDoc[key]) ops.push({ op: "replace", path: `/${key}`, value: newDoc[key] as never });
  for (const key of ["state", "data"] as const) {
    if (JSON.stringify(oldDoc[key]) === JSON.stringify(newDoc[key])) continue;
    if (oldDoc[key] === undefined) ops.push({ op: "add", path: `/${key}`, value: clone(newDoc[key]) as never });
    else if (newDoc[key] === undefined) ops.push({ op: "remove", path: `/${key}` });
    else ops.push({ op: "replace", path: `/${key}`, value: clone(newDoc[key]) as never });
  }
  return ops;
}
