// The use-case examples are played, not just rendered: a quiz that scores, a game with a winner, an estimate that follows
// its inputs. Each claim below is a behaviour a person relies on when they open the example.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useCaseExamples, USE_CASE_MODES } from "./use-case-examples.ts";
import { contentExamples } from "./examples.ts";
import { KageSession } from "../engine/session.ts";
import { validate } from "../engine/validate.ts";
import { lint } from "../engine/advice.ts";
import type { KageDoc } from "../engine/types.ts";

const window: any = { React };
runInNewContext(readFileSync(new URL("../../public/ds/bundle.js", import.meta.url), "utf8"), { window, console, Intl, document: {} });
const doc = (id: string, system = "core"): KageDoc => useCaseExamples(system).find((d) => d.id === id)!;
const session = (id: string) => new KageSession(structuredClone(doc(id)));
const shown = (s: KageSession, id: string) => s.visible(id);
const instances = (s: KageSession, prefix: string) => Object.keys(s.instances().blocks).filter((k) => k.startsWith(prefix));

test("every use case is valid, lint-clean, declares its mode, renders in every system and is offered with the shipped examples", () => {
  const ids = Object.keys(USE_CASE_MODES);
  assert.equal(ids.length, 9);
  for (const system of ["core", "ledger", "atelier"]) for (const id of ids) {
    const d = doc(id, system), v = validate(d);
    assert.deepEqual([v.errors, v.warnings], [[], []], id + " " + system);
    assert.deepEqual(lint(d), [], id + " " + system);
    const html = renderToStaticMarkup(React.createElement(window.Kages.KageRenderer, { doc: d }));
    assert.doesNotMatch(html, /kg-missing|NaN|Infinity|undefined/, id + " " + system);
    assert.ok(html.length > 800, id + " renders content");
  }
  const shipped = contentExamples().map((d) => d.id);
  for (const id of ids) assert.ok(shipped.includes(id), id + " ships with the examples");
  for (const d of contentExamples().filter((x) => ids.includes(x.id))) assert.equal(d.brief?.mode, USE_CASE_MODES[d.id]);
});

test("quiz: needs every answer, scores them, explains each one and can start over", () => {
  const s = session("study-quiz");
  assert.ok(!shown(s, "result") && !shown(s, "q1-ok"));
  s.dispatch("q1", "change", { value: "Chloroplast" }); s.dispatch("q2", "change", { value: "Oxygen" }); s.dispatch("q3", "change", { value: "Glucose" });
  s.dispatch("check", "click");
  assert.ok(shown(s, "result") && shown(s, "q1-ok") && shown(s, "q2-no") && !shown(s, "q2-ok") && shown(s, "q3-ok"));
  assert.equal(s.read("result")?.text, "You got 2 of 3 right.");
  s.dispatch("again", "click");
  assert.deepEqual([s.getState().q1, s.getState().q2, s.getState().submitted], ["", "", false]);
  assert.equal(s.read("check")?.disabled, true, "the check button waits for every answer");
});

test("flashcards: search narrows the deck, and every card keeps its own answer closed", () => {
  const s = session("flashcards");
  assert.equal(instances(s, "card~").length, 6);
  s.dispatch("search", "change", { value: "energy" });
  assert.equal(instances(s, "card~").length, 1, "only the matching card remains");
  s.dispatch("search", "change", { value: "zzz" });
  assert.equal(instances(s, "card~").length, 0); assert.ok(shown(s, "none"));
});

test("architecture explainer: selecting a part of the diagram describes it", () => {
  const s = session("architecture-explainer");
  assert.equal(instances(s, "part-row~").length, 1, "one part is described at the start");
  s.dispatch("map", "select", { id: "db" });
  const row = instances(s, "part-row~")[0], role = instances(s, "part-role~")[0], links = instances(s, "part-links~")[0];
  assert.equal(s.read(row)?.title, "Database");
  assert.match(String(s.read(role)?.text), /records that must not be lost/);
  assert.equal(s.read(links)?.text, "Talks to: API");
  s.dispatch("map", "select", { id: "nope" });
  assert.equal(instances(s, "part-row~").length, 0); assert.ok(shown(s, "part"), "an unknown selection falls back to the prompt");
});

test("tic-tac-toe: players alternate, a line wins, a full board is a draw, and nothing moves after the end", () => {
  const s = session("tic-tac-toe");
  const play = (...cells: number[]) => cells.forEach((i) => s.dispatch("board", "select", { id: "c" + i }));
  assert.equal(s.read("status")?.text, "Next move: X");
  play(0, 3, 1, 4);
  assert.deepEqual([s.getState().c0, s.getState().c3], ["X", "O"]);
  play(0); assert.equal(s.getState().c0, "X", "a taken square cannot be played again");
  play(2);
  assert.equal(s.read("status")?.text, "X wins!");
  play(5); assert.equal(s.getState().c5, "", "no move after a win");
  s.dispatch("reset", "click"); assert.equal(s.getState().c0, ""); assert.equal(s.read("status")?.text, "Next move: X");
  play(0, 1, 2, 4, 3, 5, 7, 6, 8);
  assert.equal(s.read("status")?.text, "It is a draw.");
});

test("pricing: the estimate follows the plan, the seats and the billing period", () => {
  const s = session("pricing-proposal");
  assert.equal(s.read("estimate")?.value, "$75"); // Team, 5 seats, monthly: 15 x 5
  s.dispatch("seats", "change", { value: 10 }); assert.equal(s.read("estimate")?.value, "$150");
  s.dispatch("billing", "change", { checked: true }); assert.equal(s.read("estimate")?.value, "$1,500"); // ten months for twelve
  const pick = instances(s, "plan-pick~");
  assert.equal(pick.length, 3);
  s.dispatch(pick[0], "click"); assert.equal(s.getState().plan, "starter"); assert.equal(s.read("estimate")?.value, "$800");
  assert.ok(!shown(s, "thanks")); s.dispatch("ask", "click"); assert.ok(shown(s, "thanks"));
  assert.match(String(s.read("thanks")?.text), /starter plan for 10 seats/);
});

test("trip: packing progress counts the ticks, and the day tabs switch", () => {
  const s = session("trip-itinerary");
  assert.equal(s.read("progress")?.value, 0);
  s.dispatch("p1", "change", { checked: true }); s.dispatch("p4", "change", { checked: true });
  assert.equal(s.read("progress")?.value, 2);
  s.dispatch("days", "change", { id: "d2" }); assert.equal(s.read("days")?.value, "d2");
  assert.deepEqual(doc("trip-itinerary").persist && Object.keys(doc("trip-itinerary").persist!).sort(), ["p1", "p2", "p3", "p4", "p5"], "ticks are kept in the reader's browser");
});

test("runbook: severity changes the guidance, and each step is gated on what it needs", () => {
  const s = session("incident-runbook");
  assert.ok(shown(s, "guide-sev2") && !shown(s, "guide-sev1"));
  s.dispatch("severity", "change", { value: "sev1" }); assert.ok(shown(s, "guide-sev1") && !shown(s, "guide-sev2"));
  assert.ok(shown(s, "detect") && !shown(s, "triage"));
  s.dispatch("detect-next", "click"); assert.ok(shown(s, "triage") && !shown(s, "detect"));
  assert.equal(s.read("triage-next")?.disabled, true, "mitigation waits for the owner to be paged");
  s.dispatch("page-owner", "change", { checked: true }); assert.equal(s.read("triage-next")?.disabled, false);
  s.dispatch("triage-next", "click"); assert.ok(shown(s, "mitigate"));
  assert.equal(s.read("mitigate-next")?.disabled, true); s.dispatch("status-posted", "change", { checked: true });
  s.dispatch("mitigate-next", "click"); s.dispatch("resolve-next", "click"); assert.ok(shown(s, "review"));
  s.dispatch("restart", "click"); assert.ok(shown(s, "detect")); assert.equal(s.getState().paged, false);
  s.dispatch("progress", "change", { value: "resolve" }); assert.ok(shown(s, "resolve"), "the stepper can jump");
});

test("meeting notes: the owner filter narrows the action items and the count follows", () => {
  const s = session("meeting-notes");
  assert.equal(s.read("summary")?.text, "4 action items shown");
  s.dispatch("owner", "change", { value: "Maya" });
  assert.equal(s.read("summary")?.text, "2 action items shown");
  assert.deepEqual((s.read("actions")?.rows as any[]).map((r) => r.id), ["a3", "a1"], "sorted by due date");
});

test("portfolio: the filter narrows the work, and the contact form records a message", () => {
  const s = session("project-portfolio");
  assert.equal(instances(s, "project~").length, 4);
  s.dispatch("filter", "change", { value: "Product" }); assert.equal(instances(s, "project~").length, 2);
  assert.ok(!shown(s, "thanks"));
  s.dispatch("contact", "submit", { values: { who: "Sam", email: "sam@example.com" } });
  assert.ok(shown(s, "thanks"));
});
