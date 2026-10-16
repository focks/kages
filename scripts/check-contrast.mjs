// Fails the design-system build when a declared contrast pair drops below its
// minimum in any system or theme (unless waived with a reason in
// src/design-system/contrast-pairs.json). Run by `npm run build:ds` after tokens.
import { systems } from "../src/engine/data.ts";
import { systemCard } from "../src/packs/system-card.ts";

let failing = 0;
for (const id of Object.keys(systems)) {
  const card = systemCard(id);
  const bad = card.issues.filter((i) => i.kind === "contrast");
  for (const i of bad) console.error(`  ✗ ${id}: ${i.message}`);
  failing += bad.length;
  console.log(`${id}: ${card.pairs.length} pairs, ${bad.length} failing${card.pairs.some((p) => p.waived && !p.pass) ? " (some waived)" : ""}`);
}
if (failing) { console.error(`${failing} contrast pair(s) failing; fix the token or waive it with a reason in contrast-pairs.json`); process.exit(1); }
