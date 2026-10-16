// Write (or, with --check, verify) every plugin artifact from src/plugin/generate.ts.
//   node scripts/build-plugins.mjs [--url https://private.example/api/mcp] [--check]
// The version comes from package.json; the MCP URL from --url, KAGES_PLUGIN_MCP_URL, or the hosted default.
// Stale files inside a generated plugin directory are removed, so a renamed playbook cannot linger.
import { chmodSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { generatePlugins } from "../src/plugin/generate.ts";

const arg = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : undefined);
const check = process.argv.includes("--check");
const { targets, files } = generatePlugins({ mcpUrl: arg("--url") ?? process.env.KAGES_PLUGIN_MCP_URL });

const walk = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((d) => d.isFile()).map((d) => join(d.parentPath ?? d.path, d.name)) : []);
let drift = 0;
for (const t of targets) {
  for (const f of walk(t.dir)) { const rel = f; if (!(rel in files)) { drift++; if (check) console.error(`stale: ${rel}`); else rmSync(rel); } }
}
for (const [path, content] of Object.entries(files)) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === content) continue;
  drift++;
  if (check) { console.error(`${current === null ? "missing" : "out of date"}: ${path}`); continue; }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  if (path.endsWith("/bin/kages-hook")) chmodSync(path, 0o755);
}
for (const p of Object.keys(files)) if (!check && p.endsWith("/bin/kages-hook")) chmodSync(p, 0o755);
if (check) { if (drift) { console.error(`${drift} generated file(s) differ from the sources: run npm run build:plugins`); process.exit(1); } console.log("plugins are up to date"); }
else console.log(`wrote ${Object.keys(files).length} plugin files (${drift} changed)`);
