import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checkMotion, parseRules } from "./css-check.ts";
import tokens from "../../public/ds/tokens.json" with { type: "json" };

const dir = fileURLToPath(new URL("./", import.meta.url));
const built = readFileSync(fileURLToPath(new URL("../../public/ds/bundle.css", import.meta.url)), "utf8");
const tokensCss = readFileSync(fileURLToPath(new URL("../../public/ds/tokens.css", import.meta.url)), "utf8");
const ours = readdirSync(dir).filter((f) => f.endsWith(".css"));

test("motion tokens exist in tokens.json and in the generated stylesheet", () => {
  const names = [...tokens.motion.duration.tokens, ...tokens.motion.ease.tokens].map((t) => t.name);
  assert.deepEqual(names, ["motion-duration-fast", "motion-duration-base", "motion-duration-slow", "motion-ease-out", "motion-ease-inout"]);
  for (const n of names) assert.match(tokensCss, new RegExp(`--${n}: `));
  for (const t of tokens.motion.duration.tokens) assert.match(t.value, /^\d+ms$/);
});

test("every stylesheet we author follows the policy: tokens only, no overshoot, no loops", () => {
  assert.ok(ours.length >= 8);
  for (const f of ours) assert.deepEqual(checkMotion(readFileSync(dir + f, "utf8")), [], f);
});

test("the checker rejects bounce, literal timings, infinite loops, keyframes and stepped motion", () => {
  const bad = ".a { transition: transform .3s ease-in-out; } .b { transition: opacity var(--motion-duration-fast) cubic-bezier(0.34, 1.56, 0.64, 1); } .c { animation: spin 1s infinite; } @keyframes spin { to { transform: rotate(1turn); } } .d { transition: all 200ms steps(4); }";
  const msgs = checkMotion(bad).map((i) => i.message).join("\n");
  for (const re of [/must use var\(--motion-duration/, /overshoots/, /infinite/, /keyframes/, /stepped/]) assert.match(msgs, re);
  assert.deepEqual(checkMotion(".ok { transition: transform var(--motion-duration-fast) var(--motion-ease-out); } .none { transition: none; }"), []);
});

test("the reference stylesheet's own transitions are an accepted, listed inventory (a new one needs a decision)", () => {
  const reference = readFileSync(fileURLToPath(new URL("../../reference/project/components/bundle.css", import.meta.url)), "utf8");
  const found = parseRules(reference).filter((r) => /transition|animation/.test(r.body)).map((r) => r.selector).sort();
  assert.deepEqual(found, [".kg-dd__chev", ".kg-side", ".lg-side", ".at-side"].sort());
});

test("reduced motion is enforced for the whole Kage, last in the bundle, after every transition", () => {
  const rules = parseRules(built);
  const reduce = rules.filter((r) => r.at && /prefers-reduced-motion: reduce/.test(r.at));
  assert.ok(reduce.length >= 1);
  const last = reduce.at(-1)!;
  assert.match(last.body, /transition-duration: 0\.01ms !important/);
  assert.match(last.body, /animation-duration: 0\.01ms !important/);
  assert.match(last.selector, /\.kg-kage \*/);
  const lastTransition = Math.max(...rules.filter((r) => /transition/.test(r.body) && !r.at).map((r) => r.index));
  assert.ok(last.index > lastTransition, "the global rule must come after every transition so it wins");
  assert.ok(!reduce.some((r) => /:root|\bhtml\b|\bbody\b/.test(r.selector)), "scoped to the Kage, never the app chrome");
});

test("our switch uses the tokens and relies on the global reduced-motion rule", () => {
  const apps = readFileSync(dir + "apps.css", "utf8");
  assert.match(apps, /\.kg-switch__thumb[^}]*transition: transform var\(--motion-duration-fast\) var\(--motion-ease-out\)/);
  assert.doesNotMatch(apps, /prefers-reduced-motion/, "one source of truth");
});
