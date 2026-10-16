// Bundle the CLI into one plain-JavaScript file that runs on Node 18+ with no TypeScript
// support, no node_modules and no build step on the user's machine. Source checkouts run
// the TypeScript directly (bin/kages.mjs, Node 22.18+); this is what gets published and
// what the edit hook should call, since a single file also starts faster.
//   node scripts/build-cli.mjs [--out dist/kages.mjs]
import { build } from "esbuild";
import { chmodSync, statSync } from "node:fs";

const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : "dist/kages.mjs";
await build({
  entryPoints: ["src/cli/bin.ts"], outfile: out, bundle: true, platform: "node", format: "esm", target: "node18",
  // Some bundled dependencies are CommonJS and call require(); give them one.
  banner: { js: "#!/usr/bin/env node\nimport { createRequire as __kagesCreateRequire } from 'node:module';\nconst require = __kagesCreateRequire(import.meta.url);" },
  // Postgres is only for the hosted server, never the CLI's file workspace: optional, loaded on demand.
  external: ["pg"],
  legalComments: "none", logLevel: "warning",
});
chmodSync(out, 0o755);
console.log(`${out}: ${(statSync(out).size / 1024).toFixed(0)} KB`);
