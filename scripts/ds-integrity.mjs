// Compute Subresource Integrity hashes for the served design-system assets, so
// the viewer can pin EXACTLY the bytes it loads. If bundle.js is swapped after a
// version was signed, the hash won't match and the browser refuses it — the
// lockfile's integrity guarantee, enforced by the platform. Re-run whenever the
// bundle or tokens.css changes (after `npm run tokens`).
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const dir = process.argv[2] ?? "public/ds";
const files = ["bundle.js", "bundle.css", "tokens.css"];
const out = {};
for (const f of files) {
  out[f] = "sha384-" + createHash("sha384").update(readFileSync(`${dir}/${f}`)).digest("base64");
}
writeFileSync(`${dir}/integrity.json`, JSON.stringify(out, null, 2) + "\n");
console.log(`${dir}/integrity.json:`, out);
