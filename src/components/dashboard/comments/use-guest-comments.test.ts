import { test } from "node:test";
import assert from "node:assert/strict";
import { localNote } from "./use-guest-comments.ts";

test("a guest's own note is read-only for them: nothing to vote on, edit, resolve or delete", () => {
  const n = localNote("c7", { text: "hello", block: "hero", pos: { x: 0.2, y: 0.4 } }, "Dana", new Date("2026-10-16T00:00:00Z"));
  assert.deepEqual([n.id, n.author, n.block, n.pos, n.resolved], ["c7", "guest:Dana", "hero", { x: 0.2, y: 0.4 }, false]);
  assert.deepEqual([n.canEdit, n.canDelete, n.canResolve, n.canVote], [false, false, false, false]);
  assert.equal(localNote("c8", { text: "general" }, "Dana").pos, undefined);
});
