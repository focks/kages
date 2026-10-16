import { existsSync, readFileSync } from "node:fs";
import { applyBlock, inspect, renderBlock, repoRoot, writeBlock } from "./gitignore.ts";
import { out } from "./format.ts";

/** `kages gitignore [--check|--write|--print]`. Exit: 0 current (or no repo), 2 missing/stale, 1 error. */
export function gitignoreCmd(flags: Record<string, unknown>, cwd: string): number {
  const trackStore = !!flags["track-store"];
  const block = renderBlock({ trackStore });
  if (flags.print) { out(block.join("\n")); return 0; }
  const path = typeof flags.path === "string" ? flags.path : undefined;
  const info = inspect(cwd, { path, trackStore });
  if (!info) { out("not inside a git repository; nothing to do"); return 0; }
  if (info.status === "unbalanced") throw new Error(`${info.file}: the kages-ignore start/end markers are unbalanced; fix them by hand`);
  const hints = () => { if (info.tracked.length) { out("already tracked, but should be ignored (run these yourself):"); for (const f of info.tracked) out(`  git rm --cached -- ${f}`); } };
  if (flags.write) {
    const changed = writeBlock(info.file, block);
    out(changed ? `${info.status === "missing" ? "added" : "updated"} the kages block in ${info.file}` : `${info.file} is already current`);
    hints();
    return 0;
  }
  if (info.status === "current") { out(`✓ ${info.file} has the current kages block`); hints(); return 0; }
  const before = existsSync(info.file) ? readFileSync(info.file, "utf8") : "";
  out(`${info.status === "missing" ? "no kages block in" : "stale kages block in"} ${info.file}; run \`kages gitignore --write\` to ${applyBlock(before, block).changed ? "apply" : "refresh"} it`);
  hints();
  return 2;
}

export { repoRoot };
