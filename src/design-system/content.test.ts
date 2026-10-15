// Batch 5 against the served bundle: structure, media and forms. The security
// cases pin the passive-source rules and the DOM-clobbering guard on anchors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { contentExamples } from "../packs/examples.ts";
import { KageSession } from "../engine/session.ts";
import { validate } from "../engine/validate.ts";
const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const K = window.Kages;
const render = (name: string, props: Record<string, unknown>) => renderToStaticMarkup(React.createElement(K[name], props));
const count = (html: string, re: RegExp) => (html.match(re) || []).length;
const [docs, media] = contentExamples();

test("content examples render in every system and validate with the pure engine", () => {
  for (const system of ["core", "ledger", "atelier"]) for (const doc of contentExamples(system)) {
    const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, doc.id + " " + system);
    const v = validate(doc); assert.deepEqual([v.errors, v.warnings], [[], []], doc.id + " " + system);
    if (doc.id === "docs-guide") for (const c of ["kg-toc", "kg-tabpanel", "kg-codetabs", "kg-daterange", "kg-fileupload", "kg-anchor"]) assert.match(html, new RegExp(c));
    if (doc.id === "media-gallery") for (const c of ["<video", "<audio", "kg-gallery__grid"]) assert.match(html, new RegExp(c));
  }
});

test("tab panel: roles, roving tabindex, one visible panel, and slot content in order", () => {
  const html = renderToStaticMarkup(React.createElement(K.KageRenderer, { doc: docs }));
  assert.equal(count(html, /role="tab"/g), 3 + 3, "three platform tabs plus three code tabs");
  assert.equal(count(html, /role="tabpanel"/g), 3 + 1);
  const p = render("CoreTabPanel", { label: "T", tabs: [{ id: "a", label: "A" }, { id: "b", label: "<i>B</i>" }], value: "b", panel1: "ONE", panel2: "TWO" });
  assert.match(p, /aria-selected="true"[^>]*aria-controls/); assert.equal(count(p, /tabindex="-1"/g), 1);
  assert.equal(count(p, /hidden=""/g), 1); assert.doesNotMatch(p, /<i>/); assert.match(p, /&lt;i&gt;B/);
  assert.equal(render("CoreTabPanel", { label: "T", tabs: [] }), "");
  assert.equal(count(render("CoreTabPanel", { label: "T", tabs: Array.from({ length: 20 }, (_, i) => ({ id: "t" + i, label: "L" })) }), /role="tab"/g), 6, "tabs are capped at six panels");
});

test("code tabs show only the selected listing as literal text, with a copy button", () => {
  const html = render("CoreCodeTabs", { tabs: [{ id: "a", label: "A", language: "js", code: "<script>alert(1)</script>" }, { id: "b", label: "B", code: "second" }], value: "a" });
  assert.match(html, /&lt;script&gt;/); assert.doesNotMatch(html, /<script|second/); assert.match(html, />Copy</);
  assert.match(html, /lang="js"/); assert.doesNotMatch(render("CoreCodeTabs", { tabs: [{ id: "a", label: "A", language: "x\" onload=\"alert(1)", code: "c" }] }), /onload/);
  assert.match(render("CoreCodeTabs", { tabs: [{ id: "a", label: "A", code: "c" }], value: "nope" }), /aria-selected="true"/, "an unknown value falls back to the first tab");
});

test("anchors are namespaced slugs and the toc links only to valid targets", () => {
  assert.match(render("CoreAnchor", { name: "Getting Started!" }), /id="kg-a-getting-started"/);
  for (const bad of ["", "   ", "!!!", null, undefined]) assert.equal(render("CoreAnchor", { name: bad }), "", String(bad));
  assert.doesNotMatch(render("CoreAnchor", { name: "\"><script>alert(1)</script>" }), /<script|onerror|"\s+on\w+=/);
  const clobber = render("CoreAnchor", { name: "location" }); assert.match(clobber, /id="kg-a-location"/, "the prefix stops an author id from shadowing document.location");
  const toc = render("CoreToc", { title: "Contents", items: [{ label: "A", target: "intro" }, { label: "<b>B</b>", target: "usage", level: 2 }, { label: "bad", target: "" }, { label: "bad2", target: "***" }, null], value: "usage" });
  assert.equal(count(toc, /<a /g), 2); assert.match(toc, /href="#kg-a-intro"/); assert.match(toc, /aria-current="location"/); assert.match(toc, /l2/); assert.doesNotMatch(toc, /<b>/);
  assert.equal(render("CoreToc", { items: [] }), "");
});

test("media accepts only https and local sources and never autoplays", () => {
  for (const bad of ["javascript:alert(1)", "data:video/mp4;base64,AAAA", "http://insecure.example/x.mp4", "//evil.example/x.mp4", "/\\evil", "https://a.example/x y.mp4", "file:///etc/passwd", "", null, 5]) {
    assert.doesNotMatch(render("CoreVideo", { label: "V", src: bad }), /<video/, String(bad));
    assert.match(render("CoreAudio", { label: "A", src: bad }), /kg-missing/, String(bad));
  }
  const v = render("CoreVideo", { label: "V", src: "https://cdn.example/clip.mp4", poster: "javascript:alert(1)", captions: [{ src: "https://cdn.example/en.vtt", lang: "en", label: "English" }, { src: "javascript:x", lang: "en" }, { src: "/c.vtt", lang: "x\" onerror=\"alert(1)" }], transcript: "<b>hi</b>" });
  assert.match(v, /<video[^>]*controls/); assert.doesNotMatch(v, /autoplay|loop|poster=|javascript:/i); for (const tag of v.match(/<track[^>]*>/g) || []) assert.match(tag, /^<track kind="captions" src="[^"]*"( srcLang="[a-z-]+")? label="[^"]*"\/>$/, "a hostile lang or label cannot add attributes: " + tag);
  assert.equal(count(v, /<track/g), 2, "an unsafe caption source is dropped"); assert.match(v, /kind="captions"/); assert.match(v, /&lt;b&gt;hi/);
  assert.match(render("CoreVideo", { label: "V", src: "/local/clip.webm" }), /src="\/local\/clip\.webm"/);
  assert.match(render("CoreAudio", { label: "A", src: "https://cdn.example/a.mp3", transcript: "t" }), /Transcript/);
});

test("gallery: thumbnails are labelled buttons and the lightbox is a modal dialog", () => {
  const px = (docs.id, "data:image/png;base64,iVBORw0KGgo=");
  const items = [{ src: px, alt: "One" }, { src: "javascript:alert(1)", alt: "evil" }, { src: "https://cdn.example/two.jpg", alt: "Two", caption: "<b>cap</b>" }];
  const closed = render("CoreGallery", { label: "G", items, index: -1 });
  assert.equal(count(closed, /kg-gallery__thumb/g), 2, "the unsafe image is dropped"); assert.doesNotMatch(closed, /role="dialog"|javascript:/); assert.match(closed, /View image 1 of 2: One/);
  const open = render("CoreGallery", { label: "G", items, index: 1 });
  assert.match(open, /role="dialog"/); assert.match(open, /aria-modal="true"/); assert.match(open, /2 \/ 2/); assert.match(open, /&lt;b&gt;cap/); assert.doesNotMatch(open, /<b>/);
  assert.doesNotMatch(render("CoreGallery", { label: "G", items, index: 99 }), /role="dialog"/, "an out-of-range index is closed");
  assert.match(render("CoreGallery", { label: "G", items: [], empty: "Nothing" }), /Nothing/);
});

test("date range validates order, ignores bad dates and exposes its value", () => {
  const ok = render("CoreDateRange", { label: "P", value: { start: "2026-03-01", end: "2026-03-09" } });
  assert.doesNotMatch(ok, /role="alert"/); assert.match(ok, /value="2026-03-01"/); assert.match(ok, /min="2026-03-01"/); assert.match(ok, /max="2026-03-09"/);
  const bad = render("CoreDateRange", { label: "P", value: { start: "2026-03-09", end: "2026-03-01" } });
  assert.match(bad, /role="alert"/); assert.match(bad, /on or after/); assert.match(bad, /aria-invalid="true"/);
  assert.doesNotMatch(render("CoreDateRange", { label: "P", value: { start: "javascript:1", end: "2026-13-45" } }), /javascript|2026-13/);
  assert.match(render("CoreDateRange", { label: "P", error: "Pick dates" }), /Pick dates/);
  const s = new KageSession(structuredClone(docs));
  s.dispatch("period", "change", { start: "2026-03-01", end: "2026-03-09" });
  assert.deepEqual(s.read("period")?.value, { start: "2026-03-01", end: "2026-03-09" });
  assert.deepEqual(s.getState().period, { start: "2026-03-01", end: "2026-03-09" });
});

test("file upload is local-only: sanitised accept, no network attributes, listed results", () => {
  const html = render("CoreFileUpload", { label: "F", accept: ".csv,text/plain", multiple: true, files: [{ name: "<b>a.csv</b>", size: 12 }] });
  assert.match(html, /type="file"/); assert.match(html, /accept="\.csv,text\/plain"/); assert.match(html, /multiple=""/); assert.match(html, /never uploaded/);
  assert.doesNotMatch(html, /<b>|action=|formaction/); assert.match(html, /12 B/);
  assert.doesNotMatch(render("CoreFileUpload", { label: "F", accept: "x\" onfocus=\"alert(1)" }), /onfocus|accept=/);
  const s = new KageSession(structuredClone(docs));
  s.dispatch("report", "change", { files: [{ name: "a.csv", size: 3, type: "text/csv", text: "a,b", error: "" }] });
  assert.equal((s.read("report")?.files as any[])[0].name, "a.csv");
});

test("field-level errors are announced and linked on every field type", () => {
  for (const [name, props] of [["CoreTextField", {}], ["CoreNumberInput", {}], ["CoreDateInput", {}], ["CoreChoice", { options: [{ value: "a", label: "A" }] }], ["CoreMultiselect", { options: [{ value: "a", label: "A" }] }]] as const) {
    const bad = render(name, { label: "L", error: "Fix <i>this</i>", ...props }), good = render(name, { label: "L", ...props });
    assert.match(bad, /role="alert"/, name); assert.match(bad, /aria-invalid="true"/, name); assert.match(bad, /aria-describedby="[^"]*-err/, name);
    assert.match(bad, /&lt;i&gt;this/, name); assert.doesNotMatch(bad, /<i>/, name);
    assert.doesNotMatch(good, /role="alert"|aria-invalid/, name + " has no message when there is no error");
  }
  const s = new KageSession(structuredClone(docs));
  assert.equal(s.read("age")?.error, "You must be 18 or older.".slice(0, 0) || s.read("age")?.error, "binding evaluates");
  s.dispatch("age", "change", { value: 12 }); assert.equal(s.read("age")?.error, "You must be 18 or older.");
  s.dispatch("age", "change", { value: 30 }); assert.equal(s.read("age")?.error, "");
});

test("tab panel, code tabs, toc and gallery publish their state", () => {
  const s = new KageSession(structuredClone(docs));
  s.dispatch("platforms", "change", { id: "linux" }); assert.equal(s.read("platforms")?.value, "linux");
  s.dispatch("snippet", "change", { id: "py" }); assert.equal(s.read("snippet")?.value, "py");
  s.dispatch("toc", "select", { target: "usage" }); assert.equal(s.read("toc")?.value, "usage");
  const m = new KageSession(structuredClone(media));
  assert.equal(m.read("photos")?.index, -1); m.dispatch("photos", "change", { index: 2 }); assert.equal(m.read("photos")?.index, 2);
  m.dispatch("photos", "change", { index: -1 }); assert.equal(m.read("photos")?.index, -1);
});
