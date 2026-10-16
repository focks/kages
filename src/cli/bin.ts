// Entry point of the bundled CLI (dist/kages.mjs). bin/kages.mjs does the same thing
// from source for contributors; this file exists so the bundler has one self-contained
// entry that needs no TypeScript at runtime.
import { main } from "./kages.ts";

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e) => { console.error(`error: ${e?.message ?? e}`); process.exit(1); },
);
