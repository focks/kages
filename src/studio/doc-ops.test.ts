import { test } from "node:test";
import assert from "node:assert/strict";
import { addBlock, duplicateBlock, deleteBlock, moveBlock, groupBlocks, docDiff, parentOf, subtree, setBrief, setMode } from "./doc-ops.ts";
import { applyPatch } from "../collab/patch.ts";
import type { KageDoc } from "../engine/types.ts";

// A tiny but real core doc: a stack root with two text children.
const base = (): KageDoc => ({
  kages: "1.0", id: "t", title: "T", system: "core@1", root: "root",
  blocks: {
    root: { type: "stack", slots: { children: ["a", "b"] } },
    a: { type: "text", props: { value: "A" } },
    b: { type: "text", props: { value: "B" } },
  },
});

test("addBlock appends a seeded block into the slot", () => {
  const d = addBlock(base(), "root", "children", "button");
  assert.equal(d.blocks.root.slots!.children.length, 3);
  const newId = d.blocks.root.slots!.children[2];
  assert.equal(d.blocks[newId].type, "button");
  // original untouched (immutability)
  assert.equal(base().blocks.root.slots!.children.length, 2);
});

test("addBlock creates the slot array when absent", () => {
  const d0: KageDoc = { ...base(), blocks: { ...base().blocks, c: { type: "card" } } };
  const withChild = moveBlock(d0, "a", "c", "children", 0); // card had no slots
  assert.deepEqual(withChild.blocks.c.slots!.children, ["a"]);
});

test("duplicateBlock clones a subtree with fresh ids after the original", () => {
  const nested: KageDoc = {
    ...base(),
    blocks: {
      root: { type: "stack", slots: { children: ["grp"] } },
      grp: { type: "stack", slots: { children: ["a"] } },
      a: { type: "text", props: { value: "A" } },
    },
  };
  const d = duplicateBlock(nested, "grp");
  const children = d.blocks.root.slots!.children;
  assert.equal(children.length, 2);
  assert.equal(children[0], "grp");
  const copyId = children[1];
  assert.notEqual(copyId, "grp");
  // the copy has its own child, not pointing at the original "a"
  const copyChild = d.blocks[copyId].slots!.children[0];
  assert.notEqual(copyChild, "a");
  assert.equal(d.blocks[copyChild].type, "text");
});

test("deleteBlock removes the subtree and the slot entry; refuses the root", () => {
  const d = deleteBlock(base(), "a");
  assert.deepEqual(d.blocks.root.slots!.children, ["b"]);
  assert.equal(d.blocks.a, undefined);
  assert.throws(() => deleteBlock(base(), "root"), /root/);
});

test("moveBlock reorders siblings", () => {
  const d = moveBlock(base(), "b", "root", "children", 0);
  assert.deepEqual(d.blocks.root.slots!.children, ["b", "a"]);
});

test("moveBlock refuses moving a block into its own subtree", () => {
  const nested: KageDoc = {
    ...base(),
    blocks: {
      root: { type: "stack", slots: { children: ["grp"] } },
      grp: { type: "stack", slots: { children: ["a"] } },
      a: { type: "text" },
    },
  };
  assert.throws(() => moveBlock(nested, "grp", "a", "children", 0), /subtree/);
});

test("groupBlocks wraps siblings in a container in place", () => {
  const d = groupBlocks(base(), ["a", "b"]);
  const children = d.blocks.root.slots!.children;
  assert.equal(children.length, 1);
  const gid = children[0];
  assert.equal(d.blocks[gid].type, "stack");
  assert.deepEqual(d.blocks[gid].slots!.children, ["a", "b"]);
});

test("parentOf / subtree", () => {
  assert.deepEqual(parentOf(base(), "a"), { parentId: "root", slot: "children", index: 0 });
  assert.equal(parentOf(base(), "root"), null);
  assert.deepEqual([...subtree(base(), "root")].sort(), ["a", "b", "root"]);
});

test("docDiff + applyPatch round-trips any structural edit", () => {
  const start = base();
  // a sequence of edits → the target doc
  let end = addBlock(start, "root", "children", "button");
  end = duplicateBlock(end, "a");
  end = moveBlock(end, "b", "root", "children", 0);
  end = { ...end, title: "Renamed", state: { count: 1 } };

  const ops = docDiff(start, end);
  assert.deepEqual(applyPatch(start, ops), end);
});

test("docDiff preserves additions, edits and removal of composition definitions", () => {
  const original = base();
  const added = structuredClone(original);
  added.compositions = { note: { inputs: {}, root: "body", blocks: { body: { type: "text", props: { text: "Before" } } } } };
  assert.deepEqual(applyPatch(original, docDiff(original, added)), added);
  const changed = structuredClone(added);
  changed.compositions!.note.blocks.body.props!.text = "After";
  assert.deepEqual(applyPatch(added, docDiff(added, changed)), changed);
  const removed = structuredClone(changed); delete removed.compositions;
  assert.deepEqual(applyPatch(changed, docDiff(changed, removed)), removed);
});

test("setMode keeps the rest of the brief, and null removes it", () => {
  const d = setBrief(base(), { mode: "read", audience: "Partners", evidence: ["a note"] });
  const m = setMode(d, "operate");
  assert.deepEqual(m.brief, { mode: "operate", audience: "Partners", evidence: ["a note"] });
  assert.equal(d.brief!.mode, "read", "never mutates");
  assert.equal("brief" in setMode(m, null), false);
});

test("setBrief refuses a malformed brief instead of saving it silently", () => {
  assert.throws(() => setBrief(base(), { mode: "loud" } as never), /mode must be one of/);
});

test("a brief change diffs to a single /brief patch", () => {
  const before = base(), after = setMode(before, "read");
  assert.deepEqual(docDiff(before, after), [{ op: "add", path: "/brief", value: { mode: "read" } }]);
  assert.deepEqual(docDiff(after, setMode(after, "operate")), [{ op: "replace", path: "/brief", value: { mode: "operate" } }]);
  assert.deepEqual(docDiff(after, setMode(after, null)), [{ op: "remove", path: "/brief" }]);
});
