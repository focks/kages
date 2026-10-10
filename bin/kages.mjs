#!/usr/bin/env node
// Entry for the `kages` CLI. Plain JS so the shebang runs; it imports the
// TypeScript implementation, which Node type-strips on load (Node 23+).
import { main } from "../src/cli/kages.ts";

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => { console.error(`error: ${e?.message ?? e}`); process.exit(1); },
);
