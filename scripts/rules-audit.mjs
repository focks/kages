// Dev aid for drafting named rules (src/design-system/system-rules.json): prints every
// contract's agent guidance and limits per system so each rule can cite a real source.
// Output is for reading, never committed. Usage: node scripts/rules-audit.mjs [system]
import { readFileSync } from "node:fs";
const contracts = JSON.parse(readFileSync(new URL("../src/engine/data/contracts.json", import.meta.url), "utf8"));
const only = process.argv[2];
const bySystem = {};
for (const [ref, c] of Object.entries(contracts)) (bySystem[c.system] ??= []).push([ref, c]);
for (const [sys, list] of Object.entries(bySystem)) {
  if (only && sys !== only) continue;
  console.log(`\n=== ${sys} (${list.length} contracts)`);
  for (const [ref, c] of list) {
    const use = c.agent?.use, avoid = c.agent?.avoid, limits = c.limits;
    if (!use && !avoid && !limits) continue;
    console.log(`${ref}`);
    if (use) console.log(`  use: ${use}`);
    if (avoid) console.log(`  avoid: ${avoid}`);
    if (limits) console.log(`  limits: ${JSON.stringify(limits)}`);
  }
}
