import { test } from "node:test";
import assert from "node:assert/strict";
import { SYSTEM_RULES, namedRulesMd } from "./system-rules.ts";
import { pack } from "./packs.ts";
import { contracts, systems } from "../engine/data.ts";
import { ruleById } from "../engine/rules/index.ts";

test("every system has between 5 and 8 rules and a signature move", () => {
  assert.deepEqual(Object.keys(SYSTEM_RULES).sort(), Object.keys(systems).sort());
  for (const [sys, r] of Object.entries(SYSTEM_RULES)) {
    assert.ok(r.signatureMove.length > 10, sys);
    assert.ok(r.rules.length >= 5 && r.rules.length <= 8, `${sys}: ${r.rules.length} rules`);
  }
});

test("rule shape: unique kebab ids, capped text, and a real source or lint link", () => {
  for (const [sys, r] of Object.entries(SYSTEM_RULES)) {
    const ids = r.rules.map((x) => x.id);
    assert.equal(new Set(ids).size, ids.length, `${sys}: duplicate id`);
    for (const x of r.rules) {
      assert.match(x.id, /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/, x.id);
      assert.ok(x.name.length > 0 && x.statement.length <= 160 && x.why.length <= 300 && x.why.length > 20, `${sys}/${x.id}: text limits`);
      assert.ok((x.source?.length ?? 0) + (x.lint?.length ?? 0) > 0, `${sys}/${x.id}: a rule with no source contract and no lint link is decoration`);
      for (const ref of x.source ?? []) assert.ok(contracts[ref], `${sys}/${x.id}: no contract ${ref}`);
      for (const id of x.lint ?? []) assert.ok(ruleById(id), `${sys}/${x.id}: lint rule ${id} is not registered`);
    }
  }
});

test("a rule cites contracts of its own system (core rules may cite core only)", () => {
  for (const [sys, r] of Object.entries(SYSTEM_RULES)) for (const x of r.rules) for (const ref of x.source ?? []) assert.ok(ref.startsWith(sys + "/"), `${sys}/${x.id} cites ${ref}`);
});

test("each pack carries its own rules and no other system's", () => {
  const all = Object.entries(SYSTEM_RULES);
  for (const [sys] of all) {
    const p = pack(sys);
    for (const f of ["SKILL.md", "AGENTS.md"] as const) {
      for (const [other, r] of all) for (const x of r.rules) assert.equal(p[f].includes(`**${x.name}**`), other === sys, `${sys} ${f} ${other}/${x.id}`);
    }
  }
  assert.match(namedRulesMd("atelier"), /Core's named rules also apply/);
  assert.doesNotMatch(namedRulesMd("core"), /also apply/);
});
