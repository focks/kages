// Generate the plugin's bundled skill files from the one source of truth (the
// pack generator), so the committed SKILL.md files can't drift from the engine.
// Run: npm run build:plugin   (re-run whenever a design system changes.)

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { systems } from "../src/engine/data.ts";
import { skillMd } from "../src/packs/packs.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const skillsDir = join(root, "plugins/kages/skills");

for (const id of Object.keys(systems)) {
  const dir = join(skillsDir, `kages-${id}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), skillMd(id));
  console.log(`wrote plugins/kages/skills/kages-${id}/SKILL.md`);
}
