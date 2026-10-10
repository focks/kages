// Block-level three-way merge. The flat block map with stable ids is what makes
// concurrent editing tractable: the unit of ownership is a block, so two agents
// whose patches touch DISJOINT blocks both apply cleanly, and only edits to the
// SAME block conflict. This is optimistic concurrency — patch_kage carries the
// baseVersion, and if someone saved in between we try to merge rather than
// reject outright. See oracle/collaboration.feature.

import type { KageDoc } from "../engine/types.ts";

type Json = any;

export interface BlockConflict {
  blockId: string;
  theirs: Json;
  yours: Json;
}

export interface MergeResult {
  ok: boolean;
  doc?: KageDoc;
  conflicts: BlockConflict[];
}

/** The ids whose block definition differs between two documents. Top-level
 *  non-block fields (state/data/root/system) are compared as the pseudo-block
 *  "/root" so a structural change is attributable too. */
function changedBlocks(base: KageDoc, next: KageDoc): Set<string> {
  const changed = new Set<string>();
  const ids = new Set([...Object.keys(base.blocks || {}), ...Object.keys(next.blocks || {})]);
  for (const id of ids) {
    if (JSON.stringify(base.blocks?.[id]) !== JSON.stringify(next.blocks?.[id])) changed.add(id);
  }
  for (const key of ["state", "data", "root", "system"] as const) {
    if (JSON.stringify(base[key]) !== JSON.stringify(next[key])) changed.add("/root");
  }
  return changed;
}

/** Merge `yours` and `theirs`, both derived from `base`. A block edited on only
 *  one side takes that side's version; a block edited on BOTH sides (to
 *  different values) is a conflict and nothing is committed for it. Structural
 *  (/root) edits on both sides also conflict — they need a claim on root. */
export function mergeThreeWay(base: KageDoc, theirs: KageDoc, yours: KageDoc): MergeResult {
  const theirChanges = changedBlocks(base, theirs);
  const yourChanges = changedBlocks(base, yours);
  const conflicts: BlockConflict[] = [];

  // Start from theirs (the already-committed side) and layer your non-conflicting edits on top.
  const merged: KageDoc = JSON.parse(JSON.stringify(theirs));

  for (const id of yourChanges) {
    if (theirChanges.has(id)) {
      const t = id === "/root" ? pickStructural(theirs) : theirs.blocks?.[id];
      const y = id === "/root" ? pickStructural(yours) : yours.blocks?.[id];
      if (JSON.stringify(t) !== JSON.stringify(y)) { conflicts.push({ blockId: id, theirs: t, yours: y }); continue; }
    }
    if (id === "/root") { Object.assign(merged, pickStructural(yours)); continue; }
    if (yours.blocks?.[id] === undefined) delete merged.blocks[id];
    else merged.blocks[id] = yours.blocks[id];
  }

  return { ok: conflicts.length === 0, doc: conflicts.length === 0 ? merged : undefined, conflicts };
}

function pickStructural(doc: KageDoc) {
  return { state: doc.state, data: doc.data, root: doc.root, system: doc.system };
}
