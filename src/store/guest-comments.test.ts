// Feedback from a shared link, by someone with no account. See oracle/share-feedback.feature.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Store } from "./store.ts";
import type { KageDoc } from "../engine/types.ts";
import { aspects, checkFeedback, MAX_TEXT } from "../components/dashboard/share-feedback-model.ts";

let t = 1_700_000_000_000;
const doc = (): KageDoc => ({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "page", blocks: { page: { type: "page", slots: { children: ["s1", "s2"] } }, s1: { type: "section", props: { title: "Costs" }, slots: { children: ["a"] } }, s2: { type: "section", props: { title: "  " } }, a: { type: "text", props: { text: "A" } } } });
const owner = { principal: "user:owner" };
function setup(visibility?: "private" | "link" | "public") {
  const s = new Store({ workspace: "w", clock: () => (t += 1000) });
  s.grant(owner.principal, "r", ["read", "write", "publish", "review", "admin"]);
  assert.ok(s.create("r", doc(), owner).ok);
  if (visibility && visibility !== "private") assert.ok(s.publish("k", owner, visibility).ok);
  const uuid = (s.head("k") as { uuid: string }).uuid;
  return { s, uuid };
}
const fails = (r: any, code: string) => { assert.equal(r.ok, false); assert.equal(r.error.code, code, r.error?.msg); };

test("a visitor can leave feedback on a published link, and the owner sees it as a guest comment", () => {
  for (const vis of ["link", "public"] as const) {
    const { s, uuid } = setup(vis);
    const r = s.addGuestComment(uuid, { name: "  Priya   N ", text: "The total looks high", block: "s1" });
    assert.ok(r.ok, JSON.stringify((r as any).error));
    const seen = (s.listComments("k", owner) as any).value;
    assert.equal(seen.length, 1);
    assert.deepEqual([seen[0].author, seen[0].text, seen[0].block, seen[0].canEdit], ["guest:Priya N", "The total looks high", "s1", false]);
  }
});

test("it is refused when the Kage is not open: private, unpublished, unknown, or after unpublishing", () => {
  const { s, uuid } = setup();
  fails(s.addGuestComment(uuid, { name: "x", text: "hi" }), "forbidden");
  fails(s.addGuestComment("nope", { name: "x", text: "hi" }), "not_found");
  assert.ok(s.publish("k", owner, "link").ok);
  const live = (s.head("k") as { uuid: string }).uuid;
  assert.ok(s.addGuestComment(live, { name: "x", text: "hi" }).ok);
  assert.ok(s.unpublish("k", owner).ok);
  fails(s.addGuestComment((s.head("k") as { uuid: string }).uuid, { name: "x", text: "again" }), "forbidden");
});

test("name and text are required and bounded; a bad block is refused; control characters are stripped", () => {
  const { s, uuid } = setup("link");
  fails(s.addGuestComment(uuid, { name: "   ", text: "hi" }), "invalid_comment");
  fails(s.addGuestComment(uuid, { name: "x", text: "   " }), "invalid_comment");
  fails(s.addGuestComment(uuid, { name: "x", text: "y".repeat(5000) }), "invalid_comment");
  fails(s.addGuestComment(uuid, { name: "x", text: "hi", block: "ghost" }), "unknown_block");
  const r = s.addGuestComment(uuid, { name: "Ann\u0000\n\tLee" + "z".repeat(100), text: "hi" });
  assert.ok(r.ok);
  const author = ((s.listComments("k", owner) as any).value[0].author as string);
  assert.match(author, /^guest:Ann Lee/); assert.ok(author.length <= "guest:".length + 40);
});

test("guests have their own quota, and it does not stop the owner replying", () => {
  const { s, uuid } = setup("link");
  for (let i = 0; i < 50; i++) assert.ok(s.addGuestComment(uuid, { name: "g" + i, text: "n" + i }).ok, String(i));
  fails(s.addGuestComment(uuid, { name: "late", text: "one more" }), "rate_limited");
  assert.ok(s.addComment("k", owner, { text: "owner can still comment" }).ok);
});

test("a guest can only add: no edit, delete, resolve or vote on anything", () => {
  const { s, uuid } = setup("link");
  const id = ((s.addGuestComment(uuid, { name: "g", text: "hi" }) as any).value as { id: string }).id;
  const guest = { principal: "guest:g" };
  fails(s.editComment(id, guest, "changed"), "forbidden");
  fails(s.deleteComment(id, guest), "forbidden");
  fails(s.resolveComment(id, guest, true), "forbidden");
  assert.equal(s.listComments("k", guest).ok && (s.listComments("k", guest) as any).value[0].canResolve, false);
  fails(s.patch("k", [{ op: "replace", path: "/title", value: "hijack" }] as never, guest, undefined as never), "forbidden");
});

test("the form model: sections offered in order, and the checks mirror the server", () => {
  assert.deepEqual(aspects(doc()), [{ id: "s1", label: "Costs" }]);
  assert.equal(checkFeedback("", "x"), "Add your name so the author knows who to thank.");
  assert.equal(checkFeedback("a", " "), "Write what you noticed.");
  assert.match(checkFeedback("a", "y".repeat(MAX_TEXT + 1))!, /Keep it under 2000/);
  assert.equal(checkFeedback("a", "fine"), null);
});

test("a guest can pin a note inside a block, and a bad pin is refused", () => {
  const { s, uuid } = setup("link");
  const r = s.addGuestComment(uuid, { name: "Dana", text: "move this", block: "a", pos: { x: 0.25, y: 0.75 } });
  assert.ok(r.ok, JSON.stringify((r as any).error));
  const seen = (s.listComments("k", owner) as any).value[0];
  assert.deepEqual([seen.block, seen.pos], ["a", { x: 0.25, y: 0.75 }]);
  fails(s.addGuestComment(uuid, { name: "Dana", text: "x", pos: { x: 0.5, y: 0.5 } }), "invalid_comment");           // a pin needs a block
  fails(s.addGuestComment(uuid, { name: "Dana", text: "x", block: "a", pos: { x: 2, y: 0.5 } }), "invalid_comment");  // outside the block
  fails(s.addGuestComment(uuid, { name: "Dana", text: "x", block: "a", pos: { x: NaN, y: 0.5 } }), "invalid_comment");
});
