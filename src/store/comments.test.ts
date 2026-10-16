// The discussion layer: threads, pins, votes, resolution and deletion, with the
// permission, limit and integrity rules enforced in the store (so the dashboard,
// CLI, MCP and A2A all behave identically). See oracle/comments.feature.

import { test } from "node:test";
import assert from "node:assert/strict";
import { Store, type CommentView } from "./store.ts";
import { dispatch } from "../adapters/operations.ts";
import type { KageDoc } from "../engine/types.ts";

let t = 1_700_000_000_000;
const doc = (): KageDoc => ({ kages: "1.0", id: "k", title: "K", system: "core@1", root: "page", blocks: { page: { type: "page", slots: { children: ["a", "b"] } }, a: { type: "text", props: { text: "A" } }, b: { type: "text", props: { text: "B" } } } });
const owner = { principal: "user:owner" }, writer = { principal: "user:writer" }, reader = { principal: "user:reader" }, outsider = { principal: "user:outsider" }, anon = { principal: "anon" };

function setup(visibility: "private" | "public" = "private") {
  const s = new Store({ workspace: "w", clock: () => (t += 1000) });
  s.grant(owner.principal, "r", ["read", "write", "publish", "review", "admin"]);
  s.grant(writer.principal, "r", ["read", "write"]);
  s.grant(reader.principal, "r", ["read"]);
  assert.ok(s.create("r", doc(), owner).ok);
  if (visibility === "public") assert.ok(s.publish("k", owner, "public").ok);
  return s;
}
const add = (s: Store, who: { principal: string }, input: any) => { const r = s.addComment("k", who, input); assert.ok(r.ok, JSON.stringify((r as any).error)); return (r as any).value as CommentView; };
const fails = (r: any, code: string) => { assert.equal(r.ok, false); assert.equal(r.error.code, code, r.error?.msg); };

test("a comment can be about the whole Kage, a block, or a pin inside a block", () => {
  const s = setup();
  const general = add(s, reader, { text: "  Looks good  " });
  assert.equal(general.text, "Looks good"); assert.equal(general.block, ""); assert.equal(general.version, 1); assert.equal(general.pos, undefined);
  const onBlock = add(s, reader, { block: "a", text: "Typo?" }); assert.equal(onBlock.block, "a");
  const pin = add(s, reader, { block: "b", text: "Move this up", pos: { x: 0.123456, y: 0.5 } });
  assert.deepEqual(pin.pos, { x: 0.1235, y: 0.5 }, "positions are fractions of the block, rounded");
  fails(s.addComment("k", reader, { block: "ghost", text: "x" }), "unknown_block");
  for (const pos of [{ x: 2, y: 0 }, { x: -0.1, y: 0 }, { x: NaN, y: 0 }, { x: 0.5 } as any]) fails(s.addComment("k", reader, { block: "a", text: "x", pos }), "invalid_comment");
  fails(s.addComment("k", reader, { text: "x", pos: { x: 0.5, y: 0.5 } }), "invalid_comment");
});

test("replies form a thread, inherit the parent's block, and are depth-limited", () => {
  const s = setup();
  const root = add(s, reader, { block: "a", text: "root", pos: { x: 0.2, y: 0.2 } });
  const r1 = add(s, writer, { text: "reply", parent: root.id, block: "b", pos: { x: 0.9, y: 0.9 } });
  assert.equal(r1.parent, root.id); assert.equal(r1.block, "a", "the parent's block wins"); assert.equal(r1.pos, undefined, "only a thread root is a pin");
  let parent = r1; for (let i = 0; i < 7; i++) parent = add(s, owner, { text: "deeper " + i, parent: parent.id });
  fails(s.addComment("k", owner, { text: "too deep", parent: parent.id }), "invalid_comment");
  fails(s.addComment("k", owner, { text: "x", parent: "c99999" }), "not_found");
});

test("only people who can see a Kage can read or write its discussion, and anonymous callers only read", () => {
  const s = setup(), pub = setup("public");
  fails(s.addComment("k", outsider, { text: "hi" }), "forbidden"); fails(s.listComments("k", outsider), "forbidden");
  fails(s.addComment("k", anon, { text: "hi" }), "forbidden");
  fails(s.addComment("nope", reader, { text: "hi" }), "not_found");
  add(pub, outsider, { text: "a stranger may comment on a public Kage" });
  const seen = pub.listComments("k", anon); assert.ok(seen.ok && seen.value.length === 1, "an anonymous visitor can read a public discussion");
  assert.equal(seen.ok && seen.value[0].canEdit, false); assert.equal(seen.ok && seen.value[0].canVote, false); assert.equal(seen.ok && seen.value[0].canDelete, false);
  fails(pub.addComment("k", anon, { text: "no" }), "forbidden"); fails(pub.voteComment("c1", anon, 1), "forbidden");
});

test("text is trimmed, bounded and cannot carry NUL; empty comments are refused", () => {
  const s = setup();
  for (const text of ["", "   \n ", "x".repeat(4001), "a\u0000b", 5 as any, null as any]) fails(s.addComment("k", reader, { text }), "invalid_comment");
  assert.ok(s.addComment("k", reader, { text: "x".repeat(4000) }).ok);
  assert.equal(add(s, reader, { text: "line1\r\nline2" }).text, "line1\nline2");
});

test("votes: one per person, changeable, never on your own comment, and raw votes never leak", () => {
  const s = setup();
  const c = add(s, reader, { text: "good idea" });
  fails(s.voteComment(c.id, reader, 1), "invalid_comment");
  assert.equal((s.voteComment(c.id, writer, 1) as any).value.score, 1);
  assert.equal((s.voteComment(c.id, writer, 1) as any).value.score, 1, "voting twice is still one vote");
  assert.equal((s.voteComment(c.id, owner, -1) as any).value.score, 0);
  const flipped = (s.voteComment(c.id, writer, -1) as any).value; assert.equal(flipped.score, -2); assert.equal(flipped.myVote, -1);
  assert.equal((s.voteComment(c.id, writer, 0) as any).value.score, -1);
  for (const bad of [2, -3, 0.5, NaN]) fails(s.voteComment(c.id, writer, bad), "invalid_comment");
  const view = (s.listComments("k", writer) as any).value[0]; assert.equal(view.votes, undefined, "the vote map stays on the server"); assert.equal(view.myVote, 0);
  assert.equal((s.listComments("k", owner) as any).value[0].myVote, -1);
});

test("resolution belongs to the thread root and to its author or an editor", () => {
  const s = setup();
  const root = add(s, reader, { block: "a", text: "q" }), reply = add(s, writer, { text: "a", parent: root.id });
  fails(s.resolveComment(reply.id, writer), "invalid_comment");
  fails(s.resolveComment(root.id, outsider), "forbidden");
  const other = add(s, reader, { text: "another reader's" });
  fails(s.resolveComment(other.id, reader.principal === "x" ? reader : { principal: "user:reader2" }), "forbidden");
  const done = (s.resolveComment(root.id, reader) as any).value; assert.equal(done.resolved, true); assert.equal(done.resolvedBy, "user:reader");
  assert.equal(((s.resolveComment(root.id, writer, false) as any).value as CommentView).resolved, false, "an editor can reopen it");
  assert.equal((s.resolveComment(other.id, writer) as any).ok, true, "someone with write can resolve any thread");
  const view = (s.listComments("k", reader) as any).value as CommentView[];
  assert.equal(view.find((c) => c.id === root.id)!.canResolve, true); assert.equal(view.find((c) => c.id === reply.id)!.canResolve, false);
});

test("edit is author-only; delete is author or admin; replies keep a tombstone", () => {
  const s = setup();
  const root = add(s, reader, { text: "original" }), reply = add(s, writer, { text: "reply", parent: root.id });
  fails(s.editComment(root.id, writer, "hijack"), "forbidden"); fails(s.editComment(root.id, reader, "  "), "invalid_comment");
  const edited = (s.editComment(root.id, reader, "better") as any).value; assert.equal(edited.text, "better"); assert.ok(edited.editedAt);
  fails(s.deleteComment(root.id, writer), "forbidden");
  assert.deepEqual((s.deleteComment(root.id, reader) as any).value, { id: root.id, tombstone: true });
  const after = (s.listComments("k", owner) as any).value as CommentView[];
  const tomb = after.find((c) => c.id === root.id)!; assert.deepEqual([tomb.deleted, tomb.text, tomb.author], [true, "", ""]); assert.equal(after.find((c) => c.id === reply.id)!.parent, root.id, "the thread keeps its shape");
  fails(s.editComment(root.id, reader, "zombie"), "invalid_comment"); fails(s.addComment("k", owner, { text: "x", parent: root.id }), "invalid_comment"); fails(s.voteComment(root.id, writer, 1), "invalid_comment");
  assert.deepEqual((s.deleteComment(reply.id, owner) as any).value, { id: reply.id, tombstone: false }, "an admin may delete anyone's comment");
  assert.equal(((s.listComments("k", owner) as any).value as CommentView[]).length, 0, "removing the last reply also clears the empty tombstone above it");
});

test("limits: per-author hourly rate and per-Kage total", () => {
  let now = 1_800_000_000_000;
  const s = new Store({ workspace: "w", clock: () => now });
  s.grant("user:spam", "r", ["read", "write", "publish", "review", "admin"]); assert.ok(s.create("r", doc(), { principal: "user:spam" }).ok);
  for (let i = 0; i < 60; i++) assert.ok(s.addComment("k", { principal: "user:spam" }, { text: "n" + i }).ok);
  fails(s.addComment("k", { principal: "user:spam" }, { text: "one too many" }), "rate_limited");
  s.grant("user:other", "r", ["read"]); assert.ok(s.addComment("k", { principal: "user:other" }, { text: "someone else is unaffected" }).ok);
  now += 3_700_000; assert.ok(s.addComment("k", { principal: "user:spam" }, { text: "an hour later" }).ok);
});

test("comments survive a snapshot round trip with every new field, and old snapshots still load", () => {
  const s = setup();
  const root = add(s, reader, { block: "a", text: "pin", pos: { x: 0.3, y: 0.7 } }); s.voteComment(root.id, writer, 1); add(s, owner, { text: "reply", parent: root.id }); s.resolveComment(root.id, reader);
  const back = Store.restore(JSON.parse(JSON.stringify(s.snapshot())));
  const list = (back.listComments("k", writer) as any).value as CommentView[];
  const r = list.find((c) => c.id === root.id)!; assert.deepEqual([r.pos, r.score, r.myVote, r.resolved, r.version], [{ x: 0.3, y: 0.7 }, 1, 1, true, 1]);
  const next = (back.addComment("k", owner, { text: "ids continue" }) as any).value; assert.ok(Number(next.id.slice(1)) > Number(root.id.slice(1)), "a reload never re-mints an id");
  const legacy = JSON.parse(JSON.stringify(s.snapshot())); legacy.comments = [{ id: "c1", kage: "k", block: "a", author: "agent:old", text: "old note", resolved: false, createdAt: "2026-01-01T00:00:00Z" }];
  const old = Store.restore(legacy).listComments("k", owner) as any; assert.equal(old.value[0].text, "old note"); assert.equal(old.value[0].score, 0);
});

test("deleting a Kage purges its discussion", () => {
  const s = setup(); add(s, reader, { text: "gone soon" }); assert.ok(s.remove("k", owner).ok);
  assert.equal(s.comments.all("k").length, 0);
});

test("the operation table exposes every discussion action with the same rules", () => {
  const s = setup(), ctx = (a: any) => ({ store: s, author: a, repo: "r" });
  const made: any = dispatch(ctx(reader), "comment", { kage: "k", block: "a", text: "via op", x: 0.4, y: 0.6 }); assert.ok(made.ok, JSON.stringify(made)); assert.deepEqual(made.data.pos, { x: 0.4, y: 0.6 });
  const reply: any = dispatch(ctx(writer), "comment", { kage: "k", text: "re", parent: made.data.id }); assert.ok(reply.ok);
  assert.equal((dispatch(ctx(writer), "vote_comment", { id: made.data.id, value: 1 }) as any).data.score, 1);
  const listed: any = dispatch(ctx(owner), "list_comments", { kage: "k" }); assert.equal(listed.data.length, 2);
  assert.equal((dispatch(ctx(reader), "edit_comment", { id: made.data.id, text: "edited" }) as any).data.text, "edited");
  assert.equal((dispatch(ctx(reader), "resolve_comment", { id: made.data.id }) as any).data.resolved, true);
  assert.equal((dispatch(ctx(reader), "resolve_comment", { id: made.data.id, resolved: false }) as any).data.resolved, false);
  // A private Kage does not exist as far as a stranger can tell (see oracle/security.feature); once it is public, anonymous callers may read but not write.
  assert.equal((dispatch(ctx(outsider), "list_comments", { kage: "k" }) as any).error.code, "not_found");
  assert.equal((dispatch(ctx(anon), "comment", { kage: "k", text: "x" }) as any).error.code, "not_found");
  assert.ok(s.publish("k", owner, "public").ok);
  assert.equal((dispatch(ctx(anon), "comment", { kage: "k", text: "x" }) as any).error.code, "forbidden");
  assert.equal((dispatch(ctx(writer), "delete_comment", { id: made.data.id }) as any).error.code, "forbidden");
  assert.equal((dispatch(ctx(reader), "delete_comment", { id: made.data.id }) as any).data.tombstone, true);
});

test("addComment refuses malformed, oversized or NUL-bearing suggested patches and prototype block names", () => {
  const s = setup();
  const ok = add(s, writer, { block: "a", text: "try this", suggestedPatch: [{ op: "replace", path: "/blocks/a/props/text", value: "Z" }] });
  assert.equal(ok.suggestedPatch?.length, 1, "a well-formed suggestion is still accepted");
  const bad: [string, any][] = [
    ["null op", [null]],
    ["non-object op", [5]],
    ["unknown verb", [{ op: "explode", path: "/x" }]],
    ["missing path", [{ op: "add", value: 1 }]],
    ["move without from", [{ op: "move", path: "/x" }]],
    ["prototype pointer", [{ op: "add", path: "/__proto__/x", value: 1 }]],
    ["oversized value", [{ op: "add", path: "/x", value: "x".repeat(20_000) }]],
    ["NUL in value", [{ op: "add", path: "/x", value: "a\u0000b" }]],
  ];
  for (const [label, suggestedPatch] of bad) { const r = s.addComment("k", writer, { block: "a", text: "x", suggestedPatch }); assert.equal(r.ok, false, label); if (!r.ok) assert.equal(r.error.code, "invalid_comment", label); }
  fails(s.addComment("k", writer, { block: "constructor", text: "x" }), "unknown_block");
  fails(s.addComment("k", writer, { block: "__proto__", text: "x" }), "unknown_block");
});

test("comment ids are never re-minted after the newest comments are deleted and the store is reloaded", () => {
  const s = setup();
  const c1 = add(s, writer, { text: "one" }), c2 = add(s, writer, { text: "two" });
  assert.ok(s.deleteComment(c2.id, writer).ok);
  assert.equal(s.listComments("k", owner).ok && (s.listComments("k", owner) as any).value.some((c: any) => c.id === c2.id && !c.deleted), false, "precondition: the newest comment is gone");
  const back = Store.restore(JSON.parse(JSON.stringify(s.snapshot())));
  const c3 = (back.addComment("k", writer, { text: "three" }) as any).value as CommentView;
  assert.notEqual(c3.id, c2.id, "a stale tab holding the deleted id must not reach a new comment");
  assert.notEqual(c3.id, c1.id);
});

test("edit, vote, resolve and delete are rate limited too, and the counter survives a restore", () => {
  let now = 1_800_000_000_000;
  const s = new Store({ workspace: "w", clock: () => now });
  s.grant("user:owner", "r", ["read", "write", "publish", "review", "admin"]); s.grant("user:fan", "r", ["read"]);
  assert.ok(s.create("r", doc(), { principal: "user:owner" }).ok);
  const root = (s.addComment("k", { principal: "user:owner" }, { text: "root" }) as any).value as CommentView;
  const fan = { principal: "user:fan" };
  // A loop of votes is a loop of full-workspace CAS writes, so it is capped like adding is.
  let refused = 0;
  for (let i = 0; i < 400; i++) { const r = s.voteComment(root.id, fan, i % 2 ? 1 : -1); if (!r.ok) { assert.equal(r.error.code, "rate_limited"); refused++; } }
  assert.ok(refused > 0 && refused < 400, `refused ${refused} of 400 votes`);
  const back = Store.restore(JSON.parse(JSON.stringify(s.snapshot())), { clock: () => now });
  fails(back.voteComment(root.id, fan, 1), "rate_limited");
  const edits = Array.from({ length: 400 }, (_, i) => s.editComment(root.id, { principal: "user:owner" }, "v" + i));
  assert.ok(edits.some((r) => !r.ok && r.error.code === "rate_limited"), "edits are limited");
  now += 3_700_000;
  assert.ok(s.voteComment(root.id, fan, 1).ok, "an hour later the budget is back");
});
