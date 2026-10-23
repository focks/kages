// Assert real served implementations, not a second rendering path. Guide
// navigation and evidence must remain accessible even without client scripts.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { KageSession } from "../engine/session.ts";
import { guideExamples } from "../packs/guide-examples.ts";
import { guideRoutes, chapterFromHash } from "../runtime/guide-navigation.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console });
const K = window.Kages;
const render = (name: string, props: object) => renderToStaticMarkup(React.createElement(K.implementation(`core/${name}@1.0.0`), props));

test("guide uses navigable chapter links, selected state, pagination and an accessible mobile toggle", () => {
  const html = render("guide", { title: "Field notes", chapters: [{ id: "overview", label: "Overview" }, { id: "evidence", label: "Evidence" }], value: "evidence", children: React.createElement("h1", null, "Inspect the evidence") });
  assert.match(html, /href="#evidence" aria-current="page"/);
  assert.match(html, /Skip to chapter/); assert.match(html, /aria-expanded="false"/);
  assert.match(html, /Previous chapter/); assert.doesNotMatch(html, /Next chapter/);
  assert.match(html, /<main[^>]+tabindex="-1"/);
});

test("guide routes and content cannot inject DOM or turn a fragment into external navigation", () => {
  const doc = guideExamples()[0];
  const html = render("guide", { title: '<script>alert(1)</script>', chapters: [{ id: "//evil.test", label: "Bad" }, { id: "constructor", label: "Valid slug" }, { id: "overview", label: "<img src=x>" }, { id: "overview", label: "Duplicate" }], value: "overview" });
  assert.doesNotMatch(html, /<script>|<img|evil.test|Duplicate/); assert.match(html, /&lt;img/);
  assert.equal(chapterFromHash("#evidence", guideRoutes(doc)), "evidence");
  assert.equal(chapterFromHash("", guideRoutes(doc)), "overview");
  for (const hash of ["#https://evil.test", "#%2f%2fevil.test", "#kg-a-source", "#missing"]) assert.equal(chapterFromHash(hash, guideRoutes(doc)), undefined);
  assert.deepEqual(guideRoutes({ ...doc, root: "overview" }), []);
  doc.blocks.guide.type = "core/guide@1.0.0";
  assert.equal(guideRoutes(doc).length, 6);
});

test("a disclosure wraps real child blocks and has an unwired public toggle", () => {
  const html = render("disclosure", { title: "Inspect <this>", eyebrow: "Evidence", badge: "Recommendation", children: React.createElement("a", { href: "https://example.com" }, "Primary source") });
  assert.match(html, /<details/); assert.match(html, /<summary/); assert.match(html, /Inspect &lt;this&gt;/); assert.match(html, /Primary source/);
  const s = new KageSession({ kages: "1.0", id: "e", title: "Evidence", system: "core@1", root: "d", blocks: { d: { type: "disclosure", props: { title: "Evidence" } } } });
  assert.equal(s.read("d")?.open, false); s.dispatch("d", "change", { open: true }); assert.equal(s.read("d")?.open, true);
});
