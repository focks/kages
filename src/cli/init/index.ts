// `kages init`: ensure the workspace and config, read what the project already
// says, ask only for the gaps, write the brief, and keep working files out of git.
// It is deliberately NOT a harness installer (skills, hooks, MCP): it prints the
// commands for those, so init stays predictable. Every file it touches is inside
// the workspace dir or the repo's managed .gitignore block.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Store } from "../../store/store.ts";
import { renderBriefMd } from "../../store/brief-md.ts";
import { validateBrief, type WorkspaceBrief } from "../../store/brief.ts";
import type { Provenance } from "../../store/types.ts";
import { ensureRuntimeDir, inspect, renderBlock, writeBlock } from "../gitignore.ts";
import { runInterview, ScriptedIo, type Io, type Draft } from "./interview.ts";
import { scanProject, type FsLike, type Hypothesis } from "./scan.ts";

export interface InitOptions {
  dir: string;                 // the workspace dir (store.json lives here)
  cwd: string;                 // the project root to scan
  store: Store;
  author: Provenance;
  io?: Io;                     // absent = non-interactive
  answers?: Record<string, string | string[] | undefined>;
  yes?: boolean;               // accept the scanned draft without asking
  refresh?: boolean;           // re-interview even though a brief exists
  noBrief?: boolean;
  noGitignore?: boolean;
}

export interface InitResult {
  lines: string[];             // what to tell the person, in order
  briefWritten: boolean;
  revision?: number;
  inferred: string[];
  changed: boolean;            // false when a re-run had nothing to do
  store: Store;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const fsFor = (cwd: string): FsLike => ({ readText: (p) => { try { return readFileSync(join(cwd, p), "utf8"); } catch { return null; } } });

/** Write `brief.md` only when the file is ours: untouched since the last export. A
 *  hand-edited file gets a `.new` sibling instead of being overwritten. */
function exportBriefMd(dir: string, brief: WorkspaceBrief): "written" | "unchanged" | "sidecar" {
  const file = join(dir, "brief.md"), hashFile = join(dir, "cache", "brief-export.sha");
  const md = renderBriefMd(brief);
  const current = existsSync(file) ? readFileSync(file, "utf8") : null;
  if (current === md) return "unchanged";
  const last = existsSync(hashFile) ? readFileSync(hashFile, "utf8").trim() : null;
  if (current !== null && sha(current) !== last) { writeFileSync(file + ".new", md); return "sidecar"; }
  writeFileSync(file, md);
  ensureRuntimeDir(join(dir, "cache"));
  writeFileSync(hashFile, sha(md) + "\n");
  return "written";
}

/** `inferred` = every brief field that holds scan-derived text a human has not confirmed. */
function inferredOf(draft: Draft): string[] {
  const out: string[] = [];
  for (const k of ["users", "purpose", "positioning", "voice"] as const) if (draft.fields[k] && !draft.confirmed.has(k)) out.push(k);
  return out;
}

export async function runInit(o: InitOptions): Promise<InitResult> {
  const lines: string[] = [];
  let changed = false;
  const configFile = join(o.dir, "config.json");
  mkdirSync(o.dir, { recursive: true });
  if (!existsSync(configFile)) { writeFileSync(configFile, JSON.stringify({ version: 1 }, null, 2) + "\n"); lines.push(`wrote ${configFile}`); changed = true; }

  const existing = o.store.getBrief(o.author);
  const rec = existing.ok ? existing.value.record : null;
  let result: Pick<InitResult, "briefWritten" | "revision" | "inferred"> = { briefWritten: false, revision: rec?.revision, inferred: rec?.brief.inferred ?? [] };

  if (o.noBrief) lines.push("brief skipped (--no-brief)");
  else if (rec && !o.refresh) {
    lines.push(`brief exists (revision ${rec.revision}); pass --refresh to revisit it`);
    const md = exportBriefMd(o.dir, rec.brief);
    if (md === "written") { lines.push(`exported ${join(o.dir, "brief.md")}`); changed = true; }
    if (md === "sidecar") lines.push(`brief.md was edited by hand, so the current export is in brief.md.new`);
  } else {
    const interactive = !!o.io || !!o.answers;
    if (!interactive && !o.yes) lines.push("brief not written: run `kages init` in a terminal, pass --answers <file>, or use `kages brief set --file <brief.json>`");
    else {
      const kages = o.store.list().filter((v) => o.store.canAccess(v, o.author)).map((v) => ({ title: v.doc.title, mode: v.doc.brief?.mode, system: v.resolved.system }));
      const hyp: Hypothesis = scanProject(fsFor(o.cwd), kages);
      if (hyp.purpose) lines.push(`found in the project: ${hyp.purpose.source}: "${hyp.purpose.value}" (treated as a draft, not approval)`);
      // --yes with nothing to ask: scripted with no answers, so drafts stand and stay `inferred`.
      const io = o.io ?? new ScriptedIo(o.answers ?? {});
      const draft = await runInterview(hyp, rec?.brief, io, { reopen: o.refresh === true });
      if (!draft.fields.users || !draft.fields.purpose) {
        const missing = (["users", "purpose"] as const).filter((k) => !draft.fields[k]);
        lines.push(`brief not written: still missing ${missing.join(" and ")}. Answer interactively, add them to --answers, or run \`kages brief set --file\``);
      } else {
        const inferred = inferredOf(draft);
        const input = { schema: 1, ...draft.fields, ...(inferred.length ? { inferred } : {}) } as Record<string, unknown>;
        if (!inferred.length) delete input.inferred;
        const checked = validateBrief(input);
        if (!checked.ok) lines.push(`brief not written: ${checked.errors.join("; ")}`);
        else if (rec && JSON.stringify(rec.brief) === JSON.stringify(checked.brief)) {
          // Re-running must not mint a revision for an identical brief.
          lines.push(`brief unchanged (revision ${rec.revision})`);
          const md = exportBriefMd(o.dir, rec.brief);
          if (md === "written") { lines.push(`exported ${join(o.dir, "brief.md")}`); changed = true; }
        } else {
          const set = o.store.setBrief(input, o.author, { baseRevision: rec?.revision ?? 0 });
          if (!set.ok) lines.push(`brief not written: ${set.error.msg}`);
          else {
            const r = set.value.record;
            result = { briefWritten: true, revision: r.revision, inferred };
            lines.push(`brief saved (revision ${r.revision})${inferred.length ? `; unconfirmed: ${inferred.join(", ")}` : ""}`);
            for (const w of set.value.warnings) lines.push(`! ${w}`);
            const md = exportBriefMd(o.dir, r.brief);
            lines.push(md === "sidecar" ? "brief.md was edited by hand, so the current export is in brief.md.new" : `exported ${join(o.dir, "brief.md")}`);
            changed = true;
          }
        }
      }
    }
  }

  if (!o.noGitignore) {
    const info = inspect(o.cwd);
    if (!info) lines.push("not in a git repository: no .gitignore changes");
    else if (info.status === "unbalanced") lines.push(`${info.file}: kages-ignore markers are unbalanced; left alone`);
    else if (info.status === "current") { /* nothing to say */ }
    else { writeBlock(info.file, renderBlock()); lines.push(`${info.status === "missing" ? "added" : "updated"} the kages block in ${info.file}`); changed = true; }
    if (info?.tracked.length) { lines.push("already tracked, but should be ignored (run these yourself):"); for (const f of info.tracked) lines.push(`  git rm --cached -- ${f}`); }
  }

  if (!changed) lines.push("nothing to change");
  lines.push("next: kages context   ·   kages setup skills   ·   kages from-markdown <file.md> --create");
  return { lines, changed, store: o.store, ...result };
}
