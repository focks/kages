// CLI glue for install / update / check / uninstall. All behaviour is in src/install.
import { homedir } from "node:os";
import { createInterface } from "node:readline/promises";
import { check, install, readManifest, uninstall, type Scope } from "../install/run.ts";
import { out, printJson } from "./format.ts";

export async function installCmd(cmd: "install" | "update" | "check" | "uninstall", flags: Record<string, unknown>): Promise<number> {
  const scope: Scope = flags.scope === "global" ? "global" : "project";
  const base = { project: process.cwd(), home: homedir() };
  const json = flags.json === true;
  if (cmd === "check") {
    const r = check(scope, base);
    if (json) printJson(r); else for (const l of r.lines) out(l);
    return r.exit;
  }
  const rl = process.stdin.isTTY && flags.yes !== true ? createInterface({ input: process.stdin, output: process.stderr }) : null;
  const confirm = rl ? async (q: string) => !/^n/i.test((await rl.question(`${q} [Y/n] `)).trim()) : undefined;
  try {
    if (cmd === "uninstall") { const r = await uninstall({ scope, base, yes: flags.yes === true, confirm }); for (const l of r.lines) out(l); return r.exit; }
    if (cmd === "update" && flags.check === true) { const r = check(scope, base); for (const l of r.lines) out(l); return r.exit; }
    if (cmd === "update" && !readManifest(scope, base)) { out("Kages is not installed here: run kages install"); return 1; }
    const providers = flags.providers === undefined ? undefined : String(flags.providers).split(",").map((s) => s.trim()).filter(Boolean);
    const r = await install({ scope, base, providers, hooks: flags["no-hooks"] === true ? false : undefined, skills: flags["no-skills"] === true ? false : undefined, mcp: flags.mcp === "write" ? "write" : "print", yes: flags.yes === true, dryRun: flags["dry-run"] === true, force: flags.force === true, confirm });
    if (json) printJson(r); else for (const l of r.lines) out(l);
    return r.exit;
  } finally { rl?.close(); }
}
