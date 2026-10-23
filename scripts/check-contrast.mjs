// Fails the design-system build when a declared contrast pair drops below its
// minimum in any system or theme (unless waived with a reason in
// src/design-system/contrast-pairs.json). Run by `npm run build:ds` after tokens.
import { systems } from "../src/engine/data.ts";
import { systemCard } from "../src/packs/system-card.ts";
import { PRESENTATION_PALETTES } from "../src/design-system/presentation.ts";
import { designContrast } from "../src/engine/design.ts";
import { contrast } from "../src/design-system/contrast.ts";

let failing = 0;
for (const id of Object.keys(systems)) {
  const card = systemCard(id);
  const bad = card.issues.filter((i) => i.kind === "contrast");
  for (const i of bad) console.error(`  ✗ ${id}: ${i.message}`);
  failing += bad.length;
  console.log(`${id}: ${card.pairs.length} pairs, ${bad.length} failing${card.pairs.some((p) => p.waived && !p.pass) ? " (some waived)" : ""}`);
}
for (const [id, palette] of Object.entries(PRESENTATION_PALETTES)) {
  const bad = designContrast({ ...palette, id, name: id, base: "core", fonts: {} }).filter(row => !row.ok);
  for (const mode of ["light", "dark"]) for (const role of ["ink", "ink-muted", "accent", "focus", "line-control"]) {
    const min = ["focus", "line-control"].includes(role) ? 3 : 4.5;
    if (contrast(palette[mode][role], palette[mode]["accent-soft"]) < min) bad.push({ mode, text: role, on: "accent-soft" });
  }
  bad.forEach(row => console.error(`  ✗ ${id}: ${row.mode} ${row.text} on ${row.on}`));
  failing += bad.length;
  console.log(`${id} presentation palette: ${bad.length} failing`);
}
if (failing) { console.error(`${failing} contrast pair(s) failing; fix the token or palette`); process.exit(1); }
