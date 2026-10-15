import { test } from "node:test";
import assert from "node:assert/strict";
import { buildThreads, countLive, countNodes, discussionStats, pinNumbers, visiblePins, isOrphan, shortName, popoverPlacement, fractionIn, type CommentItem } from "./comment-model.ts";

let n = 0;
const c = (over: Partial<CommentItem> = {}): CommentItem => ({ id: "c" + ++n, kage: "k", block: "", author: "user:a", text: "t", resolved: false, createdAt: `2026-03-0${Math.min(9, n)}T00:00:00Z`, score: 0, myVote: 0, canEdit: false, canDelete: false, canResolve: false, canVote: true, ...over });
const ids = (nodes: { comment: CommentItem }[]) => nodes.map((x) => x.comment.id);

test("threads nest replies under their parent and sort by the chosen order", () => {
  n = 0;
  const a = c({ score: 1 }), b = c({ score: 5 }), r1 = c({ parent: a.id, score: 0 }), r2 = c({ parent: a.id, score: 3 }), deep = c({ parent: r2.id });
  const all = [a, b, r1, r2, deep];
  const best = buildThreads(all, "best"); assert.deepEqual(ids(best), [b.id, a.id], "higher score first");
  assert.deepEqual(ids(best[1].replies), [r2.id, r1.id], "replies are ranked too"); assert.deepEqual(ids(best[1].replies[0].replies), [deep.id]);
  assert.deepEqual(ids(buildThreads(all, "new")), [b.id, a.id]); assert.deepEqual(ids(buildThreads(all, "old")), [a.id, b.id]);
  assert.deepEqual(ids(buildThreads(all, "old")[0].replies), [r1.id, r2.id]);
});

test("ties in score read oldest-first so a conversation stays in order", () => {
  n = 0; const x = c(), y = c(), z = c();
  assert.deepEqual(ids(buildThreads([z, y, x], "best")), [x.id, y.id, z.id]);
});

test("resolved threads can be hidden, and bad data cannot break or loop the tree", () => {
  n = 0; const open = c(), done = c({ resolved: true }), orphanReply = c({ parent: "c999" }), self = c(), cyc1 = c(), cyc2 = c();
  self.parent = self.id; cyc1.parent = cyc2.id; cyc2.parent = cyc1.id;
  assert.deepEqual(ids(buildThreads([open, done], "old", { showResolved: false })), [open.id]);
  assert.deepEqual(ids(buildThreads([open, done], "old")), [open.id, done.id]);
  const forest = buildThreads([orphanReply, self], "old"); assert.deepEqual(ids(forest), [orphanReply.id, self.id], "a missing parent promotes the reply to a root; a self-parent is a root");
  assert.doesNotThrow(() => buildThreads([cyc1, cyc2], "best"), "a parent cycle terminates");
  assert.equal(buildThreads([cyc1, cyc2], "best").length, 0, "(a pure cycle has no root to hang from, and must not recurse forever)");
});

test("counts: live comments exclude tombstones; stats separate open and resolved threads", () => {
  n = 0; const a = c(), r = c({ parent: a.id, deleted: true, text: "", author: "" }), r2 = c({ parent: a.id }), b = c({ resolved: true });
  const [t] = buildThreads([a, r, r2], "old"); assert.equal(countNodes(t), 3); assert.equal(countLive(t), 2);
  assert.deepEqual(discussionStats([a, r, r2, b]), { total: 3, threads: 2, open: 1, resolved: 1 });
});

test("pin numbers follow creation order and survive resolution and deletion of others", () => {
  n = 0;
  const p1 = c({ block: "a", pos: { x: 0.1, y: 0.1 } }), general = c(), p2 = c({ block: "b", pos: { x: 0.5, y: 0.5 } }), reply = c({ parent: p1.id, block: "a" }), gone = c({ block: "a", pos: { x: 0, y: 0 }, deleted: true }), p3 = c({ block: "a", pos: { x: 1, y: 1 } });
  const nums = pinNumbers([p3, p2, general, p1, reply, gone]);
  assert.deepEqual([...nums.entries()], [[p1.id, 1], [p2.id, 2], [p3.id, 3]], "only top-level, positioned, live comments are pins");
  p1.resolved = true; assert.equal(pinNumbers([p1, p2, p3]).get(p3.id), 3, "resolving does not renumber");
});

test("visible pins hide orphans and (by default) resolved threads", () => {
  n = 0; const blocks = new Set(["a", "b"]);
  const open = c({ block: "a", pos: { x: 0, y: 0 } }), done = c({ block: "b", pos: { x: 0, y: 0 }, resolved: true }), orphan = c({ block: "removed", pos: { x: 0, y: 0 } }), general = c();
  assert.deepEqual(visiblePins([open, done, orphan, general], blocks, false).map((x) => x.id), [open.id]);
  assert.deepEqual(visiblePins([open, done, orphan, general], blocks, true).map((x) => x.id), [open.id, done.id]);
  assert.equal(isOrphan(orphan, blocks), true); assert.equal(isOrphan(open, blocks), false); assert.equal(isOrphan(general, blocks), false, "a general comment is never an orphan");
});

test("display names drop the principal prefix and never throw on odd input", () => {
  assert.equal(shortName("user:ada"), "ada"); assert.equal(shortName("agent:acme/a11y"), "acme/a11y"); assert.equal(shortName(""), "deleted"); assert.equal(shortName("x".repeat(100)).length, 40);
});

test("popover placement stays inside the stage and flips near the right edge", () => {
  const stage = { width: 800, height: 600 }, size = { width: 320, height: 200 };
  assert.deepEqual(popoverPlacement({ x: 100, y: 100 }, stage, size), { left: 114, top: 88 });
  assert.equal(popoverPlacement({ x: 700, y: 100 }, stage, size).left, 700 - 14 - 320, "flips to the left of the pin");
  assert.equal(popoverPlacement({ x: 10, y: 590 }, stage, size).top, 396, "clamped above the bottom edge");
  const tiny = popoverPlacement({ x: 50, y: 50 }, { width: 200, height: 100 }, size); assert.ok(tiny.left >= 4 && tiny.top >= 4, "a stage smaller than the popover still yields a sane origin");
});

test("fractions are clamped and tolerate empty rectangles", () => {
  const r = { left: 100, top: 50, width: 200, height: 100 };
  assert.deepEqual(fractionIn(r, { x: 200, y: 100 }), { x: 0.5, y: 0.5 }); assert.deepEqual(fractionIn(r, { x: 0, y: 999 }), { x: 0, y: 1 });
  assert.deepEqual(fractionIn({ left: 0, top: 0, width: 0, height: 0 }, { x: 5, y: 5 }), { x: 0.5, y: 0.5 });
});

test("the comment hook sends a pin as flat x/y, which is what the operation accepts", async () => {
  // Guards a real bug: sending a nested `pos` object posted the comment without its pin.
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./use-comments.ts", import.meta.url), "utf8");
  assert.match(src, /x: pos\.x, y: pos\.y/);
  const ops = readFileSync(new URL("../../../adapters/operations.ts", import.meta.url), "utf8");
  assert.match(ops, /name: "comment"[^\n]*params: \[[^\]]*"x\?", "y\?"/, "the operation declares flat x and y");
});
