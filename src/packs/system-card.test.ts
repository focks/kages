import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { systemCard, type Tok } from "./system-card.ts";
import { pack, llmsTxt } from "./packs.ts";
import { systems } from "../engine/data.ts";
import { contrast, round2 } from "../design-system/contrast.ts";
import tokens from "../../public/ds/tokens.json" with { type: "json" };
import { dispatch } from "../adapters/operations.ts";
import { Store } from "../store/store.ts";

const T = tokens as unknown as { color: { tokens: Tok[] } };
const fx = (id: string) => fileURLToPath(new URL(`./__fixtures__/system-card-${id}.md`, import.meta.url));
const IDS = Object.keys(systems);

// The generator is pure, so the cards are safe to pin. Regenerate deliberately:
//   UPDATE_GOLDEN=1 node --test src/packs/system-card.test.ts
test("golden cards: the committed card equals the generated one", () => {
  for (const id of IDS) {
    const md = systemCard(id).markdown;
    if (process.env.UPDATE_GOLDEN || !existsSync(fx(id))) writeFileSync(fx(id), md);
    assert.equal(readFileSync(fx(id), "utf8"), md, `${id}: card changed; if intended, run with UPDATE_GOLDEN=1`);
  }
});

test("frontmatter version equals the registry, and every system's tokens appear exactly once", () => {
  for (const id of IDS) {
    const md = systemCard(id).markdown;
    assert.match(md, new RegExp(`^---\\nsystem: ${id}\\nversion: ${systems[id].version.replace(/\./g, "\\.")}\\n`));
    const own = T.color.tokens.filter((t) => (id === "core" ? !/^(ledger|atelier)-/.test(t.name) : t.name.startsWith(id + "-")));
    const rows = md.split("\n").filter((l) => /^\| `[a-z-]+` \| `#/.test(l));
    assert.equal(rows.length, own.length, `${id}: colour rows`);
    for (const t of own) {
      const role = id === "core" ? t.name : t.name.slice(id.length + 1);
      assert.equal(rows.filter((r) => r.startsWith(`| \`${role}\` |`)).length, 1, `${id}/${role}`);
    }
    for (const [role, ref] of Object.entries(systems[id].components)) if (id === "core" || !(ref as string).startsWith("core/")) assert.ok(md.includes(ref as string), `${id}: component ${role}`);
  }
});

test("printed ratios match an independent computation from tokens.json", () => {
  for (const id of IDS) {
    const card = systemCard(id);
    const get = (r: string, th: "light" | "dark") => (T.color.tokens.find((t) => t.name === (id === "core" ? "" : id + "-") + r)!.value as Record<string, string>)[th];
    for (const p of card.pairs) assert.equal(p.ratio, round2(contrast(get(p.text, p.theme as "light"), get(p.on, p.theme as "light"))), `${id} ${p.theme} ${p.text}/${p.on}`);
  }
});

test("a known-bad palette is reported as issues; the shipped palette has none", () => {
  for (const id of IDS) assert.deepEqual(systemCard(id).issues, [], id);
  const bad = T.color.tokens.map((t) => (t.name === "ink-muted" ? { ...t, value: { light: "#cccccc", dark: "#333333" } } : t.name === "focus" ? { ...t, usage: "" } : t));
  const issues = systemCard("core", bad).issues;
  assert.ok(issues.some((i) => i.kind === "contrast" && /ink-muted on paper/.test(i.message)));
  assert.ok(issues.some((i) => i.kind === "no-usage" && /focus/.test(i.message)));
  assert.match(systemCard("core", bad).markdown, /## Known issues\n\n- light: ink-muted/);
});

test("size cap keeps cards readable by an agent", () => {
  for (const id of IDS) assert.ok(systemCard(id).markdown.length < 12_000, `${id}: ${systemCard(id).markdown.length} bytes`);
});

test("packs, llms.txt and the plugin skills carry the card; the committed plugin files equal the generator", () => {
  for (const id of IDS) {
    assert.equal(pack(id)["SYSTEM.md"], systemCard(id).markdown);
    assert.match(llmsTxt(id), new RegExp(`/packs/${id}/SYSTEM\\.md`));
    const dir = fileURLToPath(new URL(`../../plugins/kages/skills/kages-${id}/`, import.meta.url));
    assert.equal(readFileSync(dir + "reference/system.md", "utf8"), systemCard(id).markdown, `${id}: run npm run build:plugin`);
    assert.equal(readFileSync(dir + "SKILL.md", "utf8"), pack(id)["SKILL.md"], `${id}: run npm run build:plugin`);
  }
});

test("get_system_card is public design data and rejects an unknown system", () => {
  const c = { store: new Store(), author: { principal: "anon" } };
  const r = dispatch(c, "get_system_card", { system: "ledger" }) as { ok: true; data: { markdown: string; issues: unknown[] } };
  assert.ok(r.ok && r.data.markdown.startsWith("---\nsystem: ledger"));
  assert.equal(dispatch(c, "get_system_card", { system: "nope" }).ok, false);
});
