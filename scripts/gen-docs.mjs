// Regenerate the generated regions of docs/ (the CLI and operation references) and, with
// --check, fail when a committed page differs. The pages describe the CLI and the operation
// table, so they are produced from them.   node scripts/gen-docs.mjs [--check]
import { readFileSync, writeFileSync } from "node:fs";
import { main } from "../src/cli/kages.ts";
import { cliReferenceMd, operationsMd, fill } from "../src/docs/reference.ts";

const check = process.argv.includes("--check");
let help = "";
const write = process.stdout.write.bind(process.stdout);
process.stdout.write = (s) => { help += s; return true; };
await main(["help"]);
process.stdout.write = write;

let drift = 0;
for (const [file, name, body] of [["docs/cli.md", "cli", cliReferenceMd(help)], ["docs/mcp.md", "operations", operationsMd()]]) {
  const before = readFileSync(file, "utf8"), after = fill(before, name, body);
  if (before === after) continue;
  drift++;
  if (check) console.error(`${file} is out of date`); else writeFileSync(file, after);
}
if (check && drift) { console.error("run npm run docs:gen"); process.exit(1); }
console.log(drift ? `updated ${drift} page(s)` : "docs references are up to date");
