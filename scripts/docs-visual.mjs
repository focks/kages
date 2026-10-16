// Visual gate for the docs: render every page (and the index) at a phone and a desktop
// width in headless Chrome and fail on any layout finding (sideways scroll, broken images,
// failed blocks, tiny text). Needs Chrome and a running app (npm run dev, or --url).
//   node scripts/docs-visual.mjs [--url http://localhost:3100] [--out dir]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadDocs } from "../src/docs/load.ts";
import { screenshotDoc, DEFAULTS } from "../src/cli/screenshot.ts";

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const out = arg("--out") ?? ".kages/screenshots/docs";
mkdirSync(out, { recursive: true });
const { pages, index, problems } = loadDocs();
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
let findings = 0;
for (const d of [index, ...pages.map((p) => p.doc)]) {
  const shots = await screenshotDoc(d, { ...DEFAULTS, widths: [390, 1200], url: arg("--url"), noSandbox: process.env.KAGES_CHROME_NO_SANDBOX === "1" });
  for (const s of shots) {
    writeFileSync(join(out, `${d.id}-${s.width}.png`), s.png);
    for (const i of s.issues) { findings++; console.error(`${d.id} @${s.width}px: ${i}`); }
  }
  console.log(`${d.id}: ${shots.map((s) => `${s.width}px ${s.issues.length ? s.issues.length + " finding(s)" : "ok"}`).join(", ")}`);
}
if (findings) { console.error(`${findings} layout finding(s) in the docs`); process.exit(1); }
