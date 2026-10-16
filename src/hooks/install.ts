// `kages setup hooks`: put the edit hook into a harness's configuration safely. Every
// run shows the exact change first; a malformed existing file stops the run (never
// guessed at); a backup is made before anything is replaced; the write is atomic; a
// second run changes nothing; and uninstall removes only what we added. The pure
// planning is in manifest.ts; this file is the filesystem and consent around it.
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { HarnessId } from "./harnesses.ts";
import { LAUNCHER_CMD, LAUNCHER_SH, MANIFESTS, MARKER, lineDiff, planInstall, planUninstall, type Scope } from "./manifest.ts";

export interface InstallOptions {
  harnesses: HarnessId[];
  scope: Scope;
  projectDir: string;
  homeDir: string;
  dryRun?: boolean; yes?: boolean; force?: boolean; uninstall?: boolean; noHooks?: boolean;
  /** Ask the person; absent means non-interactive. */
  confirm?: (question: string) => Promise<boolean>;
  /** Persist the answer (config.local.json hook.consent). */
  recordConsent?: (v: "accepted" | "declined") => void;
  /** Test seam: fail between writing the temp file and renaming it. */
  rename?: (from: string, to: string) => void;
}

export interface Change { /** back the existing (unreadable) file up before replacing it */ backup?: boolean; harness: HarnessId; file: string; before: string | null; after: string | null; diff: string; actions: string[]; trust: string }
export interface InstallResult { lines: string[]; changed: string[]; skipped: boolean; exit: number }

export const ALL_HARNESSES: HarnessId[] = ["claude", "cursor", "codex", "copilot"];

const launcherDir = (o: InstallOptions) => join(o.scope === "global" ? o.homeDir : o.projectDir, ".kages", "bin");
const launcherPath = (o: InstallOptions) => join(launcherDir(o), MARKER);

function commandFor(o: InstallOptions, harness: HarnessId, event: "post" | "pre" | "stop"): string {
  // The copilot file is committed and shared, so it uses a path relative to the repository; the rest are machine-local.
  const launcher = harness === "copilot" && o.scope === "project" ? `./.kages/bin/${MARKER}` : `"${launcherPath(o)}"`;
  return `${launcher} --harness ${harness} --event ${event}`;
}

function backupPath(file: string): string { let b = `${file}.bak`; for (let i = 1; existsSync(b); i++) b = `${file}.bak.${i}`; return b; }

function atomicWrite(file: string, text: string, rename: (a: string, b: string) => void, mode?: number): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, text, mode ? { mode } : undefined);
  try { rename(tmp, file); } catch (e) { rmSync(tmp, { force: true }); throw e; }
}

export function plan(o: InstallOptions): { changes: Change[]; problems: string[] } {
  const changes: Change[] = [], problems: string[] = [];
  for (const h of o.harnesses) {
    const target = MANIFESTS[h][o.scope];
    if (!target) { problems.push(`${h}: no verified ${o.scope}-scope location for its hooks; skipped`); continue; }
    const file = join(o.scope === "global" ? o.homeDir : o.projectDir, target.relPath);
    const before = existsSync(file) ? readFileSync(file, "utf8") : null;
    try {
      const p = o.uninstall ? planUninstall(h, before, file) : planInstall({ harness: h, command: (e) => commandFor(o, h, e) }, before, file);
      if (!p.changed && !o.uninstall) { changes.push({ harness: h, file, before, after: before, diff: "", actions: [], trust: MANIFESTS[h].trust }); continue; }
      changes.push({ harness: h, file, before, after: p.after, diff: lineDiff(before, p.after), actions: p.actions, trust: MANIFESTS[h].trust });
    } catch (e) {
      if (o.force) {
        // --force: back the unreadable file up and start from nothing, never overwrite it.
        const p = planInstall({ harness: h, command: (ev) => commandFor(o, h, ev) }, null, file);
        changes.push({ harness: h, file, before, backup: true, after: p.after, diff: lineDiff(null, p.after), actions: [...p.actions, `backs up the unreadable file first (${(e as Error).message})`], trust: MANIFESTS[h].trust });
      } else problems.push(`${h}: ${(e as Error).message}. Fix it, or re-run with --force to back it up and start fresh.`);
    }
  }
  return { changes, problems };
}

export async function setupHooks(o: InstallOptions): Promise<InstallResult> {
  const lines: string[] = [];
  if (o.noHooks) return { lines: ["hooks skipped (--no-hooks)"], changed: [], skipped: true, exit: 0 };
  const { changes, problems } = plan(o);
  for (const p of problems) lines.push(p);
  if (problems.length && !changes.length) return { lines, changed: [], skipped: false, exit: 1 };
  if (problems.some((p) => !/skipped$/.test(p))) return { lines: [...lines, "nothing was written because of the problem above"], changed: [], skipped: false, exit: 1 };

  const pending = changes.filter((c) => c.after !== c.before);
  for (const c of changes) {
    if (c.after === c.before) lines.push(`${c.harness}: already ${o.uninstall ? "uninstalled" : "installed"} (${c.file})`);
    else { lines.push(`${c.harness}: ${c.file}${c.before === null ? " (new file)" : ""}`); for (const l of c.diff.split("\n")) lines.push("  " + l); }
  }
  if (!pending.length) return { lines: [...lines, "nothing to change"], changed: [], skipped: false, exit: 0 };
  if (o.dryRun) return { lines: [...lines, "dry run: nothing was written"], changed: [], skipped: false, exit: 0 };

  if (!o.yes) {
    if (!o.confirm) return { lines: [...lines, "not changing any harness config without consent: re-run in a terminal, or pass --yes"], changed: [], skipped: true, exit: 0 };
    const accepted = await o.confirm(`${o.uninstall ? "Remove" : "Add"} these hooks?`);
    if (!o.uninstall) o.recordConsent?.(accepted ? "accepted" : "declined");
    if (!accepted) return { lines: [...lines, "no changes made"], changed: [], skipped: true, exit: 0 };
  }

  const rename = o.rename ?? renameSync;
  const changed: string[] = [];
  for (const c of pending) {
    if (c.backup && c.before !== null) copyFileSync(c.file, backupPath(c.file));
    if (c.after === null) { rmSync(c.file, { force: true }); changed.push(c.file); continue; }
    const mode = c.before !== null ? statSync(c.file).mode & 0o777 : undefined;
    atomicWrite(c.file, c.after, rename, mode);
    changed.push(c.file);
  }
  if (!o.uninstall) {
    const dir = launcherDir(o);
    mkdirSync(dir, { recursive: true });
    const sh = join(dir, MARKER);
    if (!existsSync(sh) || readFileSync(sh, "utf8") !== LAUNCHER_SH) { writeFileSync(sh, LAUNCHER_SH); chmodSync(sh, 0o755); changed.push(sh); }
    if (!existsSync(sh + ".cmd") || readFileSync(sh + ".cmd", "utf8") !== LAUNCHER_CMD) { writeFileSync(sh + ".cmd", LAUNCHER_CMD); changed.push(sh + ".cmd"); }
    lines.push(`installed. Next: ${[...new Set(pending.map((c) => c.trust))].join(" ")}`);
    lines.push("To skip the hook for one run, disable hooks in the harness; to remove it: kages setup hooks --uninstall");
  } else lines.push("removed the Kages hooks; the launcher script was left in place");
  return { lines, changed, skipped: false, exit: 0 };
}
