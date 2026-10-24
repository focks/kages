import { test } from "node:test";
import assert from "node:assert/strict";
import { embedOrigins, publishedEmbedOrigins, embedCsp } from "./embed-policy.ts";
import { embedHtml } from "../server/embed-html.ts";
import { polishExamples } from "../packs/polish-examples.ts";
import { Store } from "./store.ts";
import { dispatch } from "../adapters/operations.ts";

test("embed policy accepts exact origins and rejects CSP or URL ambiguity", () => {
  assert.deepEqual(embedOrigins(["https://example.com", "https://example.com/", "http://localhost:3100"]), ["https://example.com", "http://localhost:3100"]);
  for (const origin of ["*", "https://*.example.com", "https://user:pass@example.com", "https://example.com/path", "https://example.com?x=1", "https://example.com#x", "https://example.com; script-src *", "http://example.com", "javascript:alert(1)", "null"]) assert.throws(() => embedOrigins([origin]));
  assert.deepEqual(publishedEmbedOrigins({ embedOrigins: ["*"] }), []);
  assert.deepEqual(publishedEmbedOrigins(null), []);
  assert.throws(() => embedOrigins(Array(21).fill("https://example.com")));
  assert.throws(() => embedCsp([], "unsafe-inline", [], "https://example.com"));
});

test("embed HTML keeps hostile document content inert and grants no host capability", () => {
  const doc = polishExamples()[0]; doc.title = '</script><script>alert("escape")</script>';
  const result = embedHtml(doc, "example", "https://app.getkages.com", ["https://example.com"], "instance");
  assert.doesNotMatch(result.html, /<script>alert/);
  assert.match(result.html, /sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"/);
  assert.match(result.html, /Host capabilities are not enabled/);
  assert.match(result.csp, /frame-ancestors 'self' https:\/\/example.com$/);
  assert.match(result.csp, /sha256-/); assert.match(result.csp, /sha384-/);
});

test("embed changes require write access, preserve metadata and create a draft revision", () => {
  const store = new Store(); const author = { principal: "agent:embed/owner" }; store.grant(author.principal, "kages", ["write", "publish", "admin"]);
  const doc = polishExamples()[0]; doc.meta = { note: "Preserve this" };
  const ctx = { store, author }; assert.ok(dispatch(ctx, "create_kage", { doc }).ok);
  assert.ok(dispatch(ctx, "publish_kage", { name: doc.id, visibility: "link" }).ok);
  const from = store.head(doc.id)!.v;
  const result = dispatch(ctx, "set_embed_policy", { name: doc.id, origins: ["https://example.com"], baseVersion: from }); assert.ok(result.ok);
  const saved = store.head(doc.id)!; assert.equal(saved.v, from + 1); assert.equal(saved.state, "draft");
  assert.deepEqual(saved.doc.meta, { note: "Preserve this", embedOrigins: ["https://example.com"] });
  assert.equal(dispatch(ctx, "set_embed_policy", { name: doc.id, origins: [], baseVersion: from }).ok, false);
  assert.equal(dispatch({ store, author: { principal: "anon" } }, "set_embed_policy", { name: doc.id, origins: [] }).ok, false);
});
