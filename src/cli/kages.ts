// `kages` — the command-line adapter. Like every adapter it is a thin
// translation of the one operation set (plus the pure engine for offline work);
// it holds no business logic. Commands are grouped into toolsets:
//
//   learn    systems · catalog · contract · schema
//   author   validate · describe · preview · convert        (work on files, offline)
//   manage   init · create · patch · ls · get · versions · search ·
//            publish · export · state · comment             (the local artifactory)
//   dev      pack · openapi · agent-card · mcp-tools
//
// See the kages-cli skill. Offline commands never touch a store; manage commands
// load a persistent workspace (./.kages) and save it after a write.

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from "node:fs";
import { join, dirname, resolve as resolvePath } from "node:path";
import { systems, contracts } from "../engine/data.ts";
import { catalog } from "../engine/catalog.ts";
import { validate } from "../engine/validate.ts";
import { review } from "../engine/advice.ts";
import { outlineToKage } from "../engine/outline.ts";
import { screenshotDoc, parseWidths, shotFiles, DEFAULTS as SHOT_DEFAULTS } from "./screenshot.ts";
import { describe } from "../engine/describe.ts";
import { generationSchema, fromGenerated, toGenerated } from "../engine/generate.ts";
import { KageSession } from "../engine/session.ts";
import { dispatch, isWriteOp, type OpContext, type OpResult } from "../adapters/operations.ts";
import { openapi, a2aCard, mcpTools } from "../adapters/surfaces.ts";
import { setupCmd } from "./setup.ts";
import { configCmd } from "./config-cmd.ts";
import { renderBriefMd, parseBriefMd } from "../store/brief-md.ts";
import type { WorkspaceBrief } from "../store/brief.ts";
import { installCmd } from "./install-cmd.ts";
import { gitignoreCmd } from "./gitignore-cmd.ts";
import { adviceLogCmd } from "./advice-log-cmd.ts";
import { COMMANDS, commandMeta } from "../packs/commands/commands.ts";
import { gatherRender, printPacket, type Shoot } from "./critique-cmd.ts";
import { PROTOCOL } from "../packs/critique-protocol.ts";
import type { CritiquePacket } from "../packs/critique-packet.ts";
import { chooseSink } from "./advice-sinks.ts";
import { loadConfig } from "../config/load.ts";
import { kagesHome } from "./config.ts";
import { lintDetailed } from "../engine/advice.ts";
import { briefIssues } from "../engine/brief.ts";
import { systemCard } from "../packs/system-card.ts";
import { runInit } from "./init/index.ts";
import { ttyIo } from "./init/interview.ts";
import { modeOf } from "../engine/mode.ts";
import { RULES, ruleById } from "../engine/rules/index.ts";
import { pack } from "../packs/packs.ts";
import { loadStore, saveStore, owner, workspaceDir, initWorkspace } from "./workspace.ts";
import { login, logout, status, remoteCall } from "./auth.ts";
import { parseArgs, flag, type ParsedArgs } from "./args.ts";
import { printJson, table, out, err } from "./format.ts";
import type { KageBrief, KageDoc } from "../engine/types.ts";

import { VERSION } from "../version.ts";

const HELP = `kages ${VERSION} — an artifactory for agents

usage: kages <command> [args] [--flags]

auth & remote  (talk to a deployed Kages; session cached in ~/.kages)
  auth login [--url <deployment>]   sign in via the browser (Google)
  auth status | auth logout         show or clear the session
  whoami                            print the signed-in account
  remote <op> [json]                run an operation on your cloud workspace
                                    (e.g. kages remote list_kages)

learn
  systems                       list design systems
  catalog <system>              print the agent catalog for a system
  contract <ref>                print a component contract (e.g. core/stat@1.0.0)
  schema <system>               print the generation-envelope JSON Schema (tier B)

author  (operate on a .kage.json file, or a stored name; offline)
  validate <file|name> [-s sys] validate; exits 1 on errors
  lint <file|name> [--tier t]   pitfalls with rule id and severity (P0-P3); exit 2 on P0/P1
                                lint --list | lint --explain <rule>
  describe <file|name> [-s sys] text view for agents
  preview  <file|name> [-s sys] headless render snapshot (visibility + outputs)
  screenshot <file|name> [-o out.png|dir/] [--width 390,1200] [--height 900] [--dark] [--scale 1]
  convert  <file> --to envelope|doc [-s sys]
  from-markdown <file.md> [-o out.kage.json] [--title t] [--id i] [-s sys] [--toc auto|always|never] [--mode read|operate|persuade|experience] [--create]
                                write prose, get a Kage: headings → sections, > Note → alerts,
                                tables, adjacent code → tabs, FAQ → accordion, 3+ sections → contents

manage  (your CLOUD workspace when signed in, else the local ./.kages; --local forces local)
  create <file> [--repo r]      store a new Kage (validated + signed)
  patch  <name> <patch.json> [--dry-run] [--advice full|quiet|off]
                                apply RFC 6902 ops, new version; --dry-run reports what would happen
  ls [-s sys] [--state st]      list stored Kages
  search <query> [-s sys]       full-text search
  get <name> [-v n] [-o file]   print a stored Kage document
  versions <name>               revision history with provenance
  publish <name> [--visibility private|workspace|link|public]
  unpublish <name>              pull a published Kage back to draft
  review <name>                 send a draft to review
  deprecate <name>              mark a published Kage deprecated
  archive <name>                archive (hide) a Kage; reversible
  restore <name>                restore an archived Kage to published
  delete <name> --yes           permanently remove a Kage (needs admin)
  export <name> [--format json|markdown] [-o file]
  state <name>                  current app state
  comment <name> <block|-> <text> [--at x,y] [--patch file]
                                add a comment; "-" = about the whole Kage;
                                --at 0.4,0.6 pins it inside the block
  comments <name>               the discussion as an indented thread
  reply <name> <comment-id> <text>
  resolve <comment-id> [--reopen]   resolve (or reopen) a thread
  vote <comment-id> up|down|clear

review & refine  (evidence for a design review, then controlled steps)
  context [name] [--json] [--full] [-s sys]
                                the one-call session boot: brief, system rules, a Kage's findings, and what to do next
  critique <name> [--screens 390,1200] [--dark] [--json] | critique --print-protocol
                                the evidence and rubric for a design review (you or your agent score it)
  critique save <name> --file c.json | close <id> [--reason t] | export <id> [-o f]
  critiques <name>              saved critiques, newest first, with the score trend
  tune <name> --quieter|--bolder [--amount 1-3] [--scope id] [--apply]
                                a controlled step in intensity; dry run unless --apply
  improve [command] [kage]      the improvement moves; with a command, its playbook plus context
  migrate <name> [--apply] | migrate --all [--apply]
                                move deprecated props, roles and values to their replacements
  system card <id> [--json|--tokens] | system contrast <id>
                                the design system as one document; contrast exits 2 on a failing pair

workspace  (the files Kages keeps next to your project)
  init [--yes] [--answers f.json] [--refresh] [--no-brief] [--no-gitignore]
                                create the workspace, scan the project, ask up to 3 questions for the
                                workspace brief, and keep working files out of git
  brief show | set --file b.json | import --file b.md | export [-o f]   [--base-revision n] [--merge]
                                the workspace brief: product truth every agent should load first
  doctor [--fix] [--strict] [--online] [--area a,b] [--json]
  push <file|name> [--server url] [--token t] [--replace] [--publish [--visibility link|public|workspace]]   send a local Kage to a running app so it shows in the Library
  report [--kage <name>] [--include-doc] [--include-config-values] [--out <file>] [--force] [--verify] [--open]   a redacted diagnostic bundle; nothing is sent
                                drift between Kages' files and this version (config, brief, store, hooks, git, skills…)
  hook [--harness h] [--event post|pre|stop]
                                for coding harnesses: reads the hook payload on stdin, checks edited *.kage.json files
  advice-log stats [--days 7] | tail [-n 20] [--json]   [--path file]
                                what the opt-in audit log recorded (rule counts, waiver rates)
  gitignore [--check|--write|--print] [--track-store] [--path f]
                                keep working files out of git with a managed block (exit 2 = missing/stale)
  config list|get <key>|set <key> <value> [--user|--local]|unset <key>|path
                                layered settings: defaults < user < workspace < local < env < flags

install  (put Kages into the coding harnesses you use)
  install [--providers claude,codex,…] [--scope project|global] [--yes] [--dry-run] [--no-hooks] [--no-skills] [--mcp print|write] [--force]
                                skills, slash commands, agents and the edit hook; shows what it will write and asks first
  setup hooks [--harness claude,cursor,codex,copilot] [--scope project|global] [--dry-run] [--yes] [--force] [--uninstall] [--no-hooks]
                                add the edit hook to a harness: shows the exact change, asks first, reversible
  setup skills [--harness claude|codex] ...
                                install the authoring skills (one per system)
  update [--check] | check | uninstall [--yes]
                                keep the installed files current; check exits 1 when stale

dev
  mcp                           run the MCP server (stdio): operations as tools,
                                skill packs as prompts, catalogs as resources
  mcp login [--url <depl>]      sign in so the server acts on your cloud workspace
  mcp info                      what the server exposes + current auth mode
  pack <system> [-o dir]        skill pack (SKILL.md/AGENTS.md/llms.txt/catalog)
  openapi                       OpenAPI 3.1 for the REST adapter
  agent-card                    A2A agent card
  mcp-tools                     MCP tool definitions

global flags
  --json            raw JSON output (for scripts and agents)
  -s, --system      design system override
  -C, --workspace   local workspace dir (default ./.kages or $KAGES_HOME)
  --local           use the local workspace even when signed in
  -o, --out         write output to a file
  -h, --help        this help
  -v, --version     on a Kage: pick a version; alone: print kages version`;

export async function main(argv: string[]): Promise<number> {
  const { positionals, flags } = parseArgs(argv);
  const json = !!flags.json;
  const dir = workspaceDir(flag(flags, "workspace"));
  const cmd = positionals[0];
  const rest = positionals.slice(1);

  // The version is checked first: `kages --version` has no command, which would otherwise print the help.
  if (cmd === "version" || (flags.version === true && !cmd)) { out(`kages ${VERSION}`); return 0; }
  if (!cmd || cmd === "help" || flags.help) { out(HELP); return 0; }

  try {
    return await run(cmd, rest, flags, { json, dir });
  } catch (e) {
    err(`error: ${(e as Error).message}`);
    return 1;
  }
}

const isFile = (p: string) => { try { return statSync(p).isFile(); } catch { return false; } };

interface Ctx { json: boolean; dir: string; }

async function run(cmd: string, rest: string[], flags: ParsedArgs["flags"], ctx: Ctx): Promise<number> {
  const sys = flag<string>(flags, "system");
  const need = (n: number, usage: string) => { if (rest.length < n) throw new Error(`usage: kages ${usage}`); };

  // Resolve a Kage from a file path, or (failing that) a stored name.
  const resolveDoc = (target: string): KageDoc => {
    // Only a regular *.kage.json is read as a path. The MCP render tool passes an agent's `name` straight
    // here, so reading any existing path let it probe local files through the JSON parse error's snippet,
    // and a directory named like a stored Kage made readFileSync throw EISDIR instead of falling through.
    if (target && /\.kage\.json$/i.test(target) && isFile(target)) return JSON.parse(readFileSync(target, "utf8")) as KageDoc;
    const head = loadStore(ctx.dir).head(target);
    if (head) return head.doc;
    throw new Error(`no file or stored Kage '${target}'`);
  };

  // Run an operation. Signed in (and not --local) → against your CLOUD workspace
  // over the network; otherwise against the local ./.kages store (persist if it
  // mutated and succeeded). So after `kages auth login`, `kages ls` lists your
  // cloud Kages; `--local` always uses the on-disk workspace.
  const useRemote = !flags.local && !!status();
  // Advice on a successful write: agents (no TTY) get everything new; a person at a
  // terminal gets a quiet line only when something needs attention. Config and
  // --advice override either.
  const ADVICE_OPS = new Set(["create_kage", "patch_kage", "generate_kage", "set_kage_brief"]);
  const cfg = loadConfig({ readFile: (f) => (existsSync(f) ? readFileSync(f, "utf8") : null), userFile: join(kagesHome(), "config.json"), workspaceDir: ctx.dir, env: process.env });
  const advicePolicy = (): Record<string, unknown> => ({
    advice: flag<string>(flags, "advice") ?? (cfg.value.advice?.quiet || process.stdout.isTTY ? "quiet" : "full"),
    minSeverity: cfg.value.advice?.minSeverity ?? "P2",
  });
  const op = async (name: string, params: Record<string, unknown>, mutates = false): Promise<OpResult> => {
    if (mutates && ADVICE_OPS.has(name) && params.advice === undefined) params = { ...advicePolicy(), ...params };
    if (useRemote) {
      try { return { ok: true, data: await remoteCall(name, params) }; }
      catch (e) { return { ok: false, error: { code: "remote", msg: (e as Error).message } }; }
    }
    const store = loadStore(ctx.dir);
    const chosen = chooseSink({ setting: cfg.value.advice?.auditLog, env: process.env.KAGES_ADVICE_LOG, workspaceDir: ctx.dir });
    const opCtx: OpContext = { store, author: owner(), repo: flag(flags, "repo"), adapter: "cli", adviceLog: chosen.sink, deprecations: cfg.value.lint?.deprecations, logBlockIds: cfg.value.advice?.logBlockIds === true };
    const r = dispatch(opCtx, name, params);
    if (r.ok && mutates) saveStore(ctx.dir, store);
    return r;
  };
  const adviceLines = (d: unknown) => {
    const r = d as { advice?: { severity?: string; at: string; code: string; msg: string; fix?: string }[]; ack?: string; resolved?: number; existing?: number };
    for (const f of r.advice ?? []) { out(`  ${f.severity ?? "hint"} ${f.at}  ${f.code}  ${f.msg}`); if (f.fix) out(`        → ${f.fix}`); }
    if (r.ack === "clean") out(`  ✓ no new findings${r.resolved ? `, ${r.resolved} fixed` : ""}${r.existing ? `, ${r.existing} existing not repeated (kages lint ${"<name>"} lists them)` : ""}`);
  };
  const report = (r: OpResult, onOk: (data: unknown) => void): number => {
    if (!r.ok) { err(`error ${r.error.code}: ${r.error.msg}`); return 1; }
    if (ctx.json) printJson(r.data); else onOk(r.data);
    return 0;
  };

  switch (cmd) {
    // --- auth & remote (talk to a deployed Kages over the network) ---
    case "auth": return authCmd(rest, flags);
    case "whoami": {
      const s = status();
      if (!s) { err("not signed in — run `kages auth login`"); return 1; }
      out(`${s.email} @ ${s.apiUrl}`); return 0;
    }
    case "remote": {
      need(1, "remote <op> [json-params]  (e.g. kages remote list_kages)");
      const data = await remoteCall(rest[0], rest[1] ? JSON.parse(rest.slice(1).join(" ")) : {});
      printJson(data); return 0;
    }

    // --- learn ---
    case "systems": {
      const list = Object.values(systems).map((s) => ({ id: s.id, name: s.name, version: s.version, extends: s.extends ?? "—", summary: s.summary }));
      if (ctx.json) { printJson(list); return 0; }
      out(table(list, [
        { header: "id", get: (s) => s.id },
        { header: "name", get: (s) => s.name },
        { header: "version", get: (s) => s.version },
        { header: "extends", get: (s) => s.extends },
      ]));
      return 0;
    }
    case "catalog": { need(1, "catalog <system>"); if (!systems[rest[0]]) throw new Error(`no system '${rest[0]}'`); out(catalog(rest[0])); return 0; }
    case "contract": { need(1, "contract <ref>"); const c = contracts[rest[0]]; if (!c) throw new Error(`no contract '${rest[0]}' (try: kages catalog <system>)`); printJson(c); return 0; }
    case "schema": { need(1, "schema <system>"); if (!systems[rest[0]]) throw new Error(`no system '${rest[0]}'`); printJson(generationSchema(rest[0])); return 0; }

    // --- author (offline, file or stored) ---
    case "validate": {
      need(1, "validate <file|name> [-s system]");
      const doc = resolveDoc(rest[0]);
      const r = review(doc, sys);
      if (ctx.json) { printJson(r); return r.ok ? 0 : 1; }
      for (const e of r.errors) out(`  ✗ ${e.at}  ${e.code}  ${e.msg}`);
      for (const w of r.warnings) out(`  ⚠ ${w.at}  ${w.code}  ${w.msg}`);
      // What to do about each finding, and pitfalls the validator allows.
      for (const a of r.advice) out(`  ${a.level === "lint" ? "◦" : "→"} ${a.at}  ${a.level === "lint" ? a.code + "  " : ""}${a.fix ?? a.msg}`);
      out(`${r.ok ? "✓ valid" : "✗ invalid"} — ${r.errors.length} errors, ${r.warnings.length} warnings${r.portable !== undefined ? ` · portable: ${r.portable}` : ""}`);
      return r.ok ? 0 : 1;
    }
    case "lint": {
      if (flags.list) {
        if (ctx.json) { printJson(RULES.map(({ check: _c, ...m }) => m)); return 0; }
        for (const r of RULES) out(`${r.id.padEnd(24)} ${r.severity}  ${r.tier.padEnd(9)} ${r.category.padEnd(9)} ${r.summary}`);
        return 0;
      }
      if (flags.explain) {
        const r = ruleById(String(flags.explain));
        if (!r) throw new Error(`no rule '${flags.explain}' (try: kages lint --list)`);
        const { check: _c, ...meta } = r;
        if (ctx.json) printJson(meta);
        else out(`${r.id}  [${r.severity}, ${r.tier}, ${r.category}]\n${r.summary}\n\n${r.rationale}${r.modes ? `\nModes: ${r.modes.join(", ")}` : ""}`);
        return 0;
      }
      need(1, "lint <file|name> [--tier immediate|deep] [--json] | lint --list | lint --explain <rule>");
      const tier = flags.tier === "immediate" || flags.tier === "deep" ? flags.tier : undefined;
      const cfg = loadConfig({ readFile: (p) => (existsSync(p) ? readFileSync(p, "utf8") : null), userFile: join(kagesHome(), "config.json"), workspaceDir: ctx.dir, env: process.env });
      const brief = loadStore(ctx.dir).getBrief(owner());
      const r = lintDetailed(resolveDoc(rest[0]), { system: sys, tier, ignoreRules: cfg.value.lint?.ignoreRules, absent: brief.ok ? brief.value.record?.brief.absent ?? [] : [] });
      if (ctx.json) printJson(r);
      else {
        for (const f of r.findings) { out(`  ${f.severity}  ${f.at}  ${f.code}  ${f.msg}`); if (f.fix) out(`        → ${f.fix}`); }
        out(r.findings.length ? `${r.findings.length} finding(s)${r.waived.length ? `, ${r.waived.length} waived` : ""}` : `✓ clean${r.waived.length ? ` (${r.waived.length} waived)` : ""}`);
      }
      // 2 = a primary finding (P0/P1) so scripts can gate on it; 0 = clean or advisory only.
      return r.findings.some((f) => f.severity === "P0" || f.severity === "P1") ? 2 : 0;
    }
    case "describe": {
      need(1, "describe <file|name> [-s system]");
      const doc = resolveDoc(rest[0]), m = modeOf(doc);
      out(m.source === "declared" ? `mode: ${m.mode} (declared)` : `mode: ${m.mode} (inferred, ${m.confidence} confidence)`);
      out(describe(doc, sys));
      return 0;
    }
    case "preview": {
      need(1, "preview <file|name> [-s system]");
      const doc = resolveDoc(rest[0]);
      const s = new KageSession(doc, sys);
      const blocks = Object.keys(doc.blocks).map((id) => ({ id, visible: s.visible(id), output: s.read(id) }));
      if (ctx.json) { printJson({ system: s.sysId, blocks }); return 0; }
      out(table(blocks, [
        { header: "block", get: (b) => b.id },
        { header: "visible", get: (b) => (b.visible ? "yes" : "no") },
        { header: "outputs", get: (b) => Object.keys(b.output ?? {}).join(", ") },
      ]));
      return 0;
    }
    case "convert": {
      need(1, "convert <file> --to envelope|doc [-s system]");
      const to = flag<string>(flags, "to");
      const data = JSON.parse(readFileSync(rest[0], "utf8"));
      if (to === "envelope") { printJson(toGenerated(data as KageDoc, sys)); return 0; }
      if (to === "doc") { if (!sys) throw new Error("convert --to doc needs -s <system>"); printJson(fromGenerated(data, sys)); return 0; }
      throw new Error("convert needs --to envelope|doc");
    }

    // --- manage (workspace store) ---
    case "init": {
      initWorkspace(ctx.dir);
      out(`initialized workspace at ${ctx.dir}`);
      const answersFile = flag<string>(flags, "answers");
      const answers = answersFile ? (JSON.parse(readFileSync(answersFile, "utf8")) as Record<string, string | string[]>) : undefined;
      // A terminal gets the interview; CI and agents (no TTY) never block on a prompt.
      const tty = !answers && !flags.yes && !!process.stdin.isTTY;
      const io = tty ? ttyIo() : undefined;
      const store = loadStore(ctx.dir);
      try {
        // The project is whatever contains the workspace dir (the default ./.kages makes that the cwd). Using the
        // workspace, not the cwd, keeps `-C /somewhere/.kages` from editing an unrelated repo's .gitignore.
        const r = await runInit({ dir: ctx.dir, cwd: dirname(resolvePath(ctx.dir)), store, author: owner(), io, answers, yes: flags.yes === true, refresh: flags.refresh === true, noBrief: flags["no-brief"] === true, noGitignore: flags["no-gitignore"] === true });
        if (r.briefWritten) saveStore(ctx.dir, r.store);
        for (const l of r.lines) out(l);
      } finally { io?.close(); }
      return 0;
    }
    case "screenshot": {
      need(1, "screenshot <file|name> [-o out.png|dir/] [--width 390,1200] [--dark] [--url u] [--no-sandbox] [--strict]");
      const doc = resolveDoc(rest[0]);
      const widths = parseWidths(flag(flags, "width"));
      const files = shotFiles(flag<string>(flags, "out"), widths, doc.id); // before launching Chrome: a bad -o fails fast
      const shots = await screenshotDoc(doc, { ...SHOT_DEFAULTS, widths, height: Number(flag(flags, "height", SHOT_DEFAULTS.height)) || SHOT_DEFAULTS.height, dark: !!flags.dark, scale: Math.min(3, Math.max(1, Number(flag(flags, "scale", 1)) || 1)), system: sys, url: flag<string>(flags, "url"), noSandbox: !!flags["no-sandbox"] });
      shots.forEach((r, i) => { mkdirSync(dirname(files[i]), { recursive: true }); writeFileSync(files[i], r.png); });
      if (ctx.json) printJson(shots.map((r, i) => ({ file: files[i], width: r.width, height: r.height, truncated: r.truncated, blocks: r.metrics.blocks, issues: r.issues, consoleErrors: r.consoleErrors })));
      else for (const [i, r] of shots.entries()) {
        out(`${r.issues.length ? "⚠" : "✓"} ${files[i]}  ${r.width}×${r.height}  ${r.metrics.blocks} blocks${r.issues.length ? "" : "  no problems found"}`);
        for (const issue of r.issues) out(`    • ${issue}`);
      }
      return flags.strict && shots.some((r) => r.issues.length) ? 1 : 0;
    }
    case "from-markdown": {
      need(1, "from-markdown <file.md> [-o out.kage.json] [--title t] [--id i] [-s sys] [--toc auto|always|never] [--mode read|operate|persuade|experience] [--create]");
      const built = outlineToKage(readFileSync(rest[0], "utf8"), { title: flag<string>(flags, "title"), id: flag<string>(flags, "id"), system: sys, toc: flag<"auto" | "always" | "never">(flags, "toc") });
      // Only a mode the author names is recorded; guessing one would be fake certainty.
      const mode = flag<string>(flags, "mode");
      if (mode) {
        const issues = briefIssues({ mode });
        if (issues.length) throw new Error(issues.join("; "));
        built.doc = { ...built.doc, brief: { mode } as KageBrief };
      }
      const r = review(built.doc, sys?.split("@")[0]);
      if (ctx.json) {
        // --create must run before the JSON print: agents pass --json, and returning
        // here first made `--json --create` report success while storing nothing.
        let created: unknown;
        if (r.ok && flags.create) {
          const c = await op("create_kage", { doc: built.doc }, true);
          if (!c.ok) { err(`error ${c.error.code}: ${c.error.msg}`); return 1; }
          created = c.data;
        }
        printJson({ doc: built.doc, notes: built.notes, stats: built.stats, validation: { ok: r.ok, errors: r.errors, warnings: r.warnings }, advice: r.advice, ...(created === undefined ? {} : { created }) });
        return r.ok ? 0 : 1;
      }
      for (const n of built.notes) process.stderr.write(`  • ${n}\n`);
      for (const a of r.advice) process.stderr.write(`  ${a.level === "lint" ? "◦" : "→"} ${a.at}  ${a.fix ?? a.msg}\n`);
      if (!r.ok) { for (const e of r.errors) process.stderr.write(`  ✗ ${e.at}  ${e.code}  ${e.msg}\n`); return 1; }
      if (flags.create) return report(await op("create_kage", { doc: built.doc }, true), (d) => { out(`created ${(d as any).version.ref}`); adviceLines(d); });
      writeOut(flags, JSON.stringify(built.doc, null, 2));
      return 0;
    }
    case "create": {
      need(1, "create <file> [--repo r]");
      const doc = JSON.parse(readFileSync(rest[0], "utf8"));
      return report(await op("create_kage", { doc }, true), (d) => { out(`created ${(d as any).version.ref}`); adviceLines(d); });
    }
    case "patch": {
      need(2, "patch <name> <patch.json> [--dry-run]");
      const ops = JSON.parse(readFileSync(rest[1], "utf8"));
      if (flags["dry-run"]) {
        // Same verdict the real patch would give, with nothing written or counted.
        const r = await op("validate_patch", { name: rest[0], ops });
        if (!r.ok) { err(`error ${r.error.code}: ${r.error.msg}`); return 1; }
        const d = r.data as { ok: boolean; wouldCreate?: number; validation?: { errors: unknown[]; warnings: unknown[] }; diff?: { added: string[]; removed: string[]; changed: string[]; opsApplied: number }; regressions?: { severity?: string; code: string; at: string; msg: string; fix?: string }[]; error?: { code: string; msg: string; opIndex?: number } };
        if (ctx.json) { printJson(d); return d.ok ? 0 : 1; }
        out(d.ok ? `✓ would create v${d.wouldCreate} (nothing was written)` : `✗ would be refused: ${d.error?.code}: ${d.error?.msg}`);
        if (d.diff) out(`  ${d.diff.opsApplied} op(s): +${d.diff.added.length} added, -${d.diff.removed.length} removed, ~${d.diff.changed.length} changed${d.diff.changed.length ? ` (${d.diff.changed.slice(0, 6).join(", ")})` : ""}`);
        if (d.validation) out(`  validation: ${d.validation.errors.length} error(s), ${d.validation.warnings.length} warning(s)`);
        for (const f of d.regressions ?? []) { out(`  new ${f.severity ?? ""} ${f.at}  ${f.code}  ${f.msg}`); if (f.fix) out(`        → ${f.fix}`); }
        return d.ok ? 0 : 1;
      }
      return report(await op("patch_kage", { name: rest[0], ops }, true), (d) => { out(`patched → ${(d as any).version.ref}`); adviceLines(d); });
    }
    case "ls": case "list":
      return report(await op("list_kages", {}), (d) => out(kageTable(d as KageSummary[])));
    case "search": {
      need(1, "search <query> [-s system]");
      return report(await op("search_kages", { text: rest[0], system: sys, state: flag(flags, "state") }), (d) => out(kageTable(((d as any[]).map(fromVersion))))); }
    case "get": {
      need(1, "get <name> [-v n] [-o file]");
      return report(await op("get_kage", { name: rest[0], version: flag(flags, "version") }), (d) => writeOut(flags, JSON.stringify(d, null, 2)));
    }
    case "versions": {
      need(1, "versions <name>");
      return report(await op("list_versions", { name: rest[0] }), (d) => out(table(d as VersionSummary[], [
        { header: "v", get: (v) => "v" + v.v },
        { header: "state", get: (v) => v.state },
        { header: "change", get: (v) => v.change.summary },
        { header: "author", get: (v) => v.author.principal },
        { header: "digest", get: (v) => v.digest.slice(0, 19) },
      ])));
    }
    case "push": {
      // Carry a local Kage into a running app so it shows in the Library. See src/cli/push-cmd.ts.
      need(1, "push <file|name> [--server url] [--replace] [--publish]");
      const { push, pushCmd, httpCall } = await import("./push-cmd.ts");
      const server = flag<string>(flags, "server") ?? process.env.KAGES_SERVER ?? "http://localhost:3000";
      const token = flag<string>(flags, "token") ?? process.env.KAGES_TOKEN;
      return pushCmd(await push(resolveDoc(rest[0]), server, httpCall(server, token), { replace: flags.replace === true, publish: flags.publish === true, visibility: flag<string>(flags, "visibility") }));
    }
    case "publish":
      need(1, "publish <name> [--visibility v]");
      return report(await op("publish_kage", { name: rest[0], visibility: flag(flags, "visibility") }, true), (d) => out(`published ${(d as any).version.ref}`));
    case "unpublish":
      need(1, "unpublish <name>");
      return report(await op("unpublish_kage", { name: rest[0] }, true), (d) => out(`unpublished → draft ${(d as any).version.ref}`));
    case "review":
      need(1, "review <name>");
      return report(await op("submit_for_review", { name: rest[0] }, true), (d) => out(`sent to review ${(d as any).version.ref}`));
    case "deprecate":
      need(1, "deprecate <name>");
      return report(await op("deprecate_kage", { name: rest[0] }, true), (d) => out(`deprecated ${(d as any).version.ref}`));
    case "archive":
      need(1, "archive <name>");
      return report(await op("archive_kage", { name: rest[0] }, true), (d) => out(`archived ${(d as any).version.ref}`));
    case "restore":
      need(1, "restore <name>");
      return report(await op("restore_kage", { name: rest[0] }, true), (d) => out(`restored → published ${(d as any).version.ref}`));
    case "delete":
      need(1, "delete <name> --yes");
      if (!flags.yes) { err(`delete is permanent. Re-run with --yes to remove '${rest[0]}'.`); return 1; }
      return report(await op("delete_kage", { name: rest[0] }, true), (d) => out(`deleted ${(d as any).deleted}`));
    case "export": {
      need(1, "export <name> [--format json|markdown] [-o file]");
      return report(await op("export_kage", { name: rest[0], format: flag(flags, "format") ?? "json" }), (d) => writeOut(flags, typeof d === "string" ? d : JSON.stringify(d, null, 2)));
    }
    case "state":
      need(1, "state <name>");
      return report(await op("get_state", { name: rest[0] }), (d) => printJson(d));
    case "comment": {
      need(3, "comment <name> <block|-> <text> [--at x,y] [--patch file]");
      const suggestedPatch = flags.patch ? JSON.parse(readFileSync(flag<string>(flags, "patch")!, "utf8")) : undefined;
      const at = flag<string>(flags, "at")?.split(",").map(Number);
      if (at && (at.length !== 2 || at.some((n) => !Number.isFinite(n)))) throw new Error("--at takes x,y as numbers between 0 and 1, e.g. --at 0.4,0.6");
      return report(await op("comment", { kage: rest[0], block: rest[1] === "-" ? "" : rest[1], text: rest.slice(2).join(" "), suggestedPatch, ...(at ? { x: at[0], y: at[1] } : {}) }, true), (d) => out(`comment ${(d as any).id}${(d as any).block ? " on " + (d as any).block : ""}`));
    }
    case "comments": {
      need(1, "comments <name>");
      return report(await op("list_comments", { kage: rest[0] }), (d) => {
        const all = d as any[];
        if (!all.length) return out("no comments");
        const kids = (id?: string) => all.filter((c) => c.parent === id).sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt));
        const show = (c: any, depth: number) => {
          const head = c.deleted ? "[deleted]" : `${c.author}${c.block ? " @" + c.block : ""}${c.pos ? ` (${c.pos.x},${c.pos.y})` : ""}${c.resolved ? " ✓resolved" : ""}`;
          out(`${"  ".repeat(depth)}${c.id} ${head}  ${c.score >= 0 ? "+" : ""}${c.score}${c.deleted ? "" : "\n" + "  ".repeat(depth + 1) + c.text.split("\n").join("\n" + "  ".repeat(depth + 1))}`);
          kids(c.id).forEach((k) => show(k, depth + 1));
        };
        kids(undefined).forEach((c) => show(c, 0));
      });
    }
    case "reply": {
      need(3, "reply <name> <comment-id> <text>");
      return report(await op("comment", { kage: rest[0], parent: rest[1], text: rest.slice(2).join(" ") }, true), (d) => out(`comment ${(d as any).id} (reply to ${rest[1]})`));
    }
    case "resolve": {
      need(1, "resolve <comment-id> [--reopen]");
      return report(await op("resolve_comment", { id: rest[0], resolved: flags.reopen !== true }, true), (d) => out(`${(d as any).id} ${(d as any).resolved ? "resolved" : "reopened"}`));
    }
    case "vote": {
      need(2, "vote <comment-id> up|down|clear");
      const value = { up: 1, down: -1, clear: 0 }[rest[1] as "up"];
      if (value === undefined) throw new Error("usage: kages vote <comment-id> up|down|clear");
      return report(await op("vote_comment", { id: rest[0], value }, true), (d) => out(`${(d as any).id} score ${(d as any).score}`));
    }

    // --- setup (wire Kages into a harness) ---
    case "setup": {
      const raw = flags.harness;
      const harnesses = (raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]) as string[];
      return setupCmd(rest, harnesses, flags, ctx.dir);
    }

    case "install": case "update": case "check": case "uninstall": return installCmd(cmd, flags);
    case "doctor": {
      // Reports drift; never repairs it as a side effect. `--fix` applies only findings marked safe.
      const { runDoctor, formatDoctor } = await import("../doctor/run.ts");
      const { buildDoctorCtx } = await import("../doctor/context.ts");
      const store = existsSync(join(ctx.dir, "store.json")) ? loadStore(ctx.dir) : null;
      const ping = flags.online ? async (url: string): Promise<string | null> => {
        try { const { default: pg } = await import("pg"); const c = new pg.Client({ connectionString: url, connectionTimeoutMillis: 3000 }); await c.connect(); await c.end(); return null; }
        catch (e) { return String((e as Error).message ?? e).replace(url, "<url>").slice(0, 80); }
      } : undefined;
      const mk = () => buildDoctorCtx({ dir: ctx.dir, store, author: owner(), configHome: kagesHome(), ping });
      const areas = typeof flags.area === "string" ? flags.area.split(",") : undefined;
      let report = await runDoctor(mk(), { areas, ignore: (cfg.value as { doctor?: { ignore?: string[] } }).doctor?.ignore });
      const fixed: string[] = [];
      if (flags.fix) {
        for (const f of report.findings.filter((x) => x.fix?.safe)) {
          if (f.id === "store-orphans" && store) { const n = store.pruneOrphans(); saveStore(ctx.dir, store); fixed.push(`removed ${n.comments} orphaned comment(s) and ${n.critiques} critique(s)`); }
          else if (f.id.startsWith("gitignore-block")) { const info = (await import("./gitignore.ts")).inspect(dirname(resolvePath(ctx.dir))); if (info) { (await import("./gitignore.ts")).writeBlock(info.file, (await import("./gitignore.ts")).renderBlock()); fixed.push(`rewrote the kages block in ${info.file}`); } }
        }
        report = await runDoctor(mk(), { areas, ignore: (cfg.value as { doctor?: { ignore?: string[] } }).doctor?.ignore });
      }
      if (ctx.json) printJson({ ...report, fixed });
      else { for (const l of fixed) out(`fixed: ${l}`); out(formatDoctor(report)); }
      if (report.findings.some((f) => f.severity === "route") && flags.strict) return 1;
      return 0;
    }
    case "report": {
      // Nothing is sent: markdown on stdout, redacted. See src/cli/report-cmd.ts.
      const [{ reportCmd }, { runDoctor }, { buildDoctorCtx }, { readManifest, detectProviders }, { VERSION }, { homedir }, { createInterface }] = await Promise.all([import("./report-cmd.ts"), import("../doctor/run.ts"), import("../doctor/context.ts"), import("../install/run.ts"), import("../version.ts"), import("node:os"), import("node:readline/promises")]);
      const store = existsSync(join(ctx.dir, "store.json")) ? loadStore(ctx.dir) : null;
      const base = { project: process.cwd(), home: homedir() };
      const doctor = await runDoctor(buildDoctorCtx({ dir: ctx.dir, store, author: owner(), configHome: kagesHome() }), {}).catch(() => null);
      const target = typeof flags.kage === "string" ? flags.kage : undefined;
      const head = target && store ? store.head(target) : undefined;
      if (target && !head) throw new Error(`no stored Kage '${target}'`);
      const logPath = (cfg.value as { advice?: { auditLog?: unknown } }).advice?.auditLog;
      let adviceLog = null as { calls: number; writes: number; writesWithRegressions: number } | null;
      if (typeof logPath === "string" && existsSync(logPath)) { const { readLog, statsOf } = await import("./advice-log-cmd.ts"); const s = statsOf(readLog(logPath).entries); adviceLog = { calls: s.calls, writes: s.writes, writesWithRegressions: s.writesWithRegressions }; }
      const rl = process.stdin.isTTY ? createInterface({ input: process.stdin, output: process.stderr }) : null;
      try {
        return await reportCmd(flags, {
          versions: { kages: VERSION, node: process.version, platform: process.platform, arch: process.arch, packageManager: (process.env.npm_config_user_agent ?? "unknown").split(" ")[0], install: import.meta.url.endsWith(".ts") ? "source" : "bundle" },
          env: process.env, home: homedir(), config: cfg, doctor, manifest: readManifest("project", base) ?? readManifest("global", base),
          detectedHarnesses: detectProviders("project", base), kage: head ? { name: target!, doc: head.doc, versions: store!.versions(target!).length } : undefined, adviceLog,
          isTTY: !!process.stdin.isTTY,
          confirm: async (q) => (flags.yes === true ? true : rl ? /^y/i.test((await rl.question(`${q} [y/N] `)).trim()) : false),
          open: (url) => { import("node:child_process").then(({ spawn }) => spawn(process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open", process.platform === "win32" ? ["/c", "start", "", url] : [url], { stdio: "ignore", detached: true }).unref()); },
        });
      } finally { rl?.close(); }
    }
    case "hook": {
      // Called by a coding harness after (or before) it edits a file. Silent and exit 0 unless it has
      // something to say; see src/hooks/run.ts.
      const [{ handleHook }, { nodeFs }, { readStdin }] = await Promise.all([import("../hooks/run.ts"), import("../hooks/node-fs.ts"), import("../hooks/stdin.ts")]);
      const r = await handleHook({ stdin: await readStdin(), fs: nodeFs, cwd: process.cwd(), home: process.env.HOME, env: process.env, harness: flag<string>(flags, "harness"), event: flag<string>(flags, "event") });
      if (r.stdout) process.stdout.write(r.stdout);
      return r.exit;
    }
    case "improve": {
      if (!rest[0]) {
        if (ctx.json) { printJson(COMMANDS); return 0; }
        let cat = "";
        for (const c of COMMANDS) { if (c.category !== cat) { cat = c.category; out(`\n${cat}`); } out(`  ${c.name.padEnd(10)} ${c.description}`); }
        out("\nkages improve <command> [kage]   assemble the playbook with its context (nothing runs by itself)");
        return 0;
      }
      if (!commandMeta(rest[0])) throw new Error(`no improve command '${rest[0]}' (${COMMANDS.map((c) => c.name).join(", ")})`);
      const r = await op("get_improve_packet", { command: rest[0], kage: rest[1] });
      return report(r, (d) => out((d as { text: string }).text));
    }
    case "tune": {
      need(1, "tune <name> --quieter|--bolder [--amount 1-3] [--scope blockId] [--apply]");
      const direction = flags.quieter ? "quieter" : flags.bolder ? "bolder" : undefined;
      if (!direction || (flags.quieter && flags.bolder)) throw new Error("pass exactly one of --quieter or --bolder");
      const amount = flags.amount === undefined ? 1 : Number(flags.amount);
      const r = await op("tune_kage", { name: rest[0], direction, amount, scope: flag<string>(flags, "scope") ?? "doc", apply: flags.apply === true }, flags.apply === true);
      return report(r, (d) => {
        const t = d as { knobs: { block: string; prop: string; from: unknown; to: unknown; rule: string }[]; skipped: { block?: string; reason: string }[]; loudness: { before: number; after: number }; applied: boolean; wouldCreate: string | null; mode: string; modeSource: string; validation?: { ok: boolean } };
        out(`${rest[0]}: ${direction} ×${amount} · mode ${t.mode} (${t.modeSource}) · loudness ${t.loudness.before} → ${t.loudness.after}`);
        for (const k of t.knobs) out(`  ${k.block.padEnd(18)} ${k.prop.padEnd(9)} ${JSON.stringify(k.from ?? null)} → ${JSON.stringify(k.to)}   (${k.rule})`);
        for (const s of t.skipped) out(`  skipped ${s.block ?? ""} ${s.reason}`);
        if (!t.knobs.length) out("  nothing to change");
        else out(t.applied ? "  applied as one new version" : `  dry run: nothing was written (re-run with --apply to create ${t.wouldCreate})`);
      });
    }
    case "critiques": {
      need(1, "critiques <name> [--json]");
      return report(await op("list_critiques", { kage: rest[0] }), (d) => {
        const r = d as { critiques: { id: string; version: number; total: number; max: number; counts: Record<string, number>; priorities: { sev: string; status: string }[]; method: string; state: string; stale: boolean; createdAt: string }[]; trend: { line: string } };
        out(r.trend.line);
        for (const c of r.critiques) out(`${c.id.padEnd(5)} v${String(c.version).padEnd(3)} ${c.total}/${c.max}  open P0 ${c.priorities.filter((p) => p.sev === "P0" && p.status === "open").length} P1 ${c.priorities.filter((p) => p.sev === "P1" && p.status === "open").length}  ${c.method}${c.stale ? "  (the Kage has changed since)" : ""}${c.state === "closed" ? "  closed" : ""}`);
        if (!r.critiques.length) out(`no critiques yet: kages critique ${rest[0]}`);
      });
    }
    case "critique": {
      if (rest[0] === "save") {
        need(2, "critique save <name> --file critique.json");
        const file = flag<string>(flags, "file");
        if (!file) throw new Error("usage: kages critique save <name> --file critique.json");
        return report(await op("save_critique", { kage: rest[1], ...JSON.parse(readFileSync(file, "utf8")) }, true), (d) => { const c = d as { id: string; total: number; max: number; counts: Record<string, number> }; out(`saved ${c.id}: ${c.total}/${c.max} (P0 ${c.counts.P0}, P1 ${c.counts.P1}, P2 ${c.counts.P2}, P3 ${c.counts.P3})`); });
      }
      if (rest[0] === "close") {
        need(2, "critique close <id> [--reason text]");
        return report(await op("close_critique", { id: rest[1], reason: flag<string>(flags, "reason") ?? "" }, true), (d) => out(`closed ${(d as { id: string }).id}`));
      }
      if (rest[0] === "export") {
        need(2, "critique export <id> [-o file]");
        return report(await op("export_critique", { id: rest[1] }), (d) => writeOut(flags, String(d)));
      }
      if (flags["print-protocol"]) { out(PROTOCOL); return 0; }
      need(1, "critique <name> [--screens 390,1200] [--dark] [--json] | critique --print-protocol");
      const doc = resolveDoc(rest[0]);
      const shoot: Shoot = (d, o) => screenshotDoc(d, { ...SHOT_DEFAULTS, widths: o.widths, dark: o.dark, system: sys, noSandbox: !!flags["no-sandbox"] || process.env.KAGES_CHROME_NO_SANDBOX === "1", url: flag<string>(flags, "url") });
      const render = await gatherRender(doc, rest[0], ctx.dir, flags, shoot);
      const r = await op("critique_kage", { name: rest[0], ...(render ? { render } : {}) });
      return report(r, (d) => printPacket(d as CritiquePacket, false));
    }
    case "migrate": {
      need(flags.all ? 0 : 1, "migrate <name> [--apply] | migrate --all [--apply]");
      const names = flags.all ? ((await op("list_kages", {})).ok ? ((await op("list_kages", {})) as { ok: true; data: { name: string }[] }).data.map((k) => k.name) : []) : [rest[0]];
      let code = 0, any = false;
      for (const name of names) {
        const r = await op("migrate_kage", { name, apply: flags.apply === true }, flags.apply === true);
        if (!r.ok) { err(`error ${r.error.code}: ${r.error.msg}`); code = 1; continue; }
        const d = r.data as { patch: unknown[]; manual: { id: string; at: string; message: string }[]; migrations: string[]; applied: boolean; wouldCreate: string | null };
        if (ctx.json) { printJson({ name, ...d }); continue; }
        if (!d.patch.length && !d.manual.length) { if (!flags.all) out(`${name}: nothing deprecated`); continue; }
        any = true;
        out(`${name}: ${d.patch.length} automatic change(s) [${d.migrations.join(", ")}]${d.applied ? ", applied" : d.wouldCreate ? `, would create ${d.wouldCreate} (re-run with --apply)` : ""}`);
        for (const m of d.manual) out(`  needs a decision  ${m.at}  ${m.message}`);
      }
      if (flags.all && !any && !ctx.json) out("nothing deprecated in any Kage");
      return code;
    }
    case "context": {
      const r = await op("get_context", { kage: rest[0], system: sys, full: flags.full === true });
      // Locally, the cheap half of doctor adds one directive: it reports, and never repairs unasked.
      if (r.ok && !useRemote) {
        const { doctorLite } = await import("../doctor/run.ts");
        const { buildDoctorCtx } = await import("../doctor/context.ts");
        const lite = await doctorLite(buildDoctorCtx({ dir: ctx.dir, store: null, author: owner(), configHome: kagesHome() }));
        if (lite.length) {
          const data = r.data as { directives: unknown[]; text: string };
          const message = `${lite.length} file(s) around this project are out of date or missing (${[...new Set(lite.map((f) => f.id))].slice(0, 4).join(", ")}).`;
          data.directives.push({ code: "CONTEXT_STALE", severity: "info", message, command: "kages doctor" });
          data.text += `\n  [info] CONTEXT_STALE: ${message}\n        run: kages doctor`;
        }
      }
      return report(r, (d) => out((d as { text: string }).text));
    }
    case "system": {
      const sub = rest[0], id = rest[1];
      if ((sub !== "card" && sub !== "contrast") || !id) throw new Error("usage: kages system card <id> [--json|--tokens] | kages system contrast <id> [--json]");
      if (!systems[id]) throw new Error(`no system '${id}'`);
      const card = systemCard(id);
      if (sub === "card") {
        if (ctx.json) printJson({ markdown: card.markdown, issues: card.issues, contrast: card.pairs });
        else if (flags.tokens) out(card.markdown.split("\n---\n")[0].replace(/^---\n/, ""));
        else out(card.markdown);
        return 0;
      }
      // contrast: one line per pair per theme; exit 2 when a pair fails without a waiver.
      const failing = card.pairs.filter((p) => !p.pass && !p.waived);
      if (ctx.json) printJson({ pairs: card.pairs, failing: failing.length });
      else {
        for (const p of card.pairs) out(`${p.pass ? "pass" : p.waived ? "waived" : "FAIL"}  ${p.theme.padEnd(5)} ${p.text} on ${p.on}  ${Number.isNaN(p.ratio) ? "n/a" : p.ratio.toFixed(2)}:1 (needs ${p.min}:1)`);
        out(failing.length ? `${failing.length} failing pair(s)` : "all declared pairs pass");
      }
      return failing.length ? 2 : 0;
    }
    case "brief": {
      const sub = rest[0] ?? "show";
      const file = (flag<string>(flags, "file") ?? rest[1]);
      const showBrief = (d: unknown) => {
        const { brief, revision, updatedBy, updatedAt, warnings } = d as { brief: WorkspaceBrief | null; revision: number; updatedBy?: string; updatedAt?: string; warnings?: string[] };
        if (!brief) { out("no workspace brief yet. Add one: kages brief set --file brief.json  (or kages brief import brief.md)"); return; }
        out(`revision ${revision}${updatedBy ? ` · ${updatedBy}` : ""}${updatedAt ? ` · ${updatedAt}` : ""}\n`);
        out(renderBriefMd(brief));
        for (const w of warnings ?? []) out(`! ${w}`);
      };
      if (sub === "show") return report(await op("get_brief", {}), showBrief);
      if (sub === "set" || sub === "import") {
        if (!file) throw new Error(`usage: kages brief ${sub} --file <${sub === "set" ? "brief.json" : "brief.md"}> [--base-revision n] [--merge]`);
        let brief: unknown;
        const text = readFileSync(file, "utf8");
        if (sub === "import") {
          const parsed = parseBriefMd(text);
          if (!parsed.ok) { err(`error invalid_brief: ${parsed.errors.join("; ")}`); return 1; }
          for (const n of parsed.notes) out(`note: ${n}`);
          brief = parsed.brief;
        } else brief = JSON.parse(text);
        return report(await op("set_brief", { brief, baseRevision: flags["base-revision"], merge: flags.merge === true }, true), (d) => { const r = d as { revision: number; warnings?: string[] }; out(`brief saved (revision ${r.revision})`); for (const w of r.warnings ?? []) out(`! ${w}`); });
      }
      if (sub === "export") {
        const r = await op("get_brief", {});
        if (!r.ok) { err(`error ${r.error.code}: ${r.error.msg}`); return 1; }
        const brief = (r.data as { brief: WorkspaceBrief | null }).brief;
        if (!brief) { err("no workspace brief to export"); return 1; }
        writeOut(flags, renderBriefMd(brief));
        return 0;
      }
      throw new Error(`unknown brief command '${sub}' (show, set, import, export)`);
    }
    case "config": return configCmd(rest, flags, ctx.dir);
    case "gitignore": return gitignoreCmd(flags, process.cwd());
    case "advice-log": return adviceLogCmd(rest, flags, join(ctx.dir, "advice.log.ndjson"));

    // --- dev ---
    case "mcp": {
      const sub = rest[0];
      if (sub === "login") { const email = await login(flag<string>(flags, "url")); out(`signed in as ${email} — the MCP server now acts on your cloud workspace`); return 0; }
      if (sub === "info") return mcpInfo(useRemote ? status() : null, ctx);
      // stdio MCP server: NOTHING may go to stdout but protocol messages, so this
      // case prints only to stderr. Operations run through the same op() path as
      // every other command (cloud when signed in, else the local workspace).
      const s = status();
      process.stderr.write(useRemote && s
        ? `kages mcp: serving your cloud workspace (signed in as ${s.email})\n`
        : `kages mcp: serving the local workspace (${ctx.dir}) — run \`kages mcp login\` to use your cloud workspace\n`);
      const { createMcpServer } = await import("../adapters/mcp.ts");
      const { renderTool } = await import("./render-tool.ts");
      const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
      const server = createMcpServer((name, params) => op(name, params, isWriteOp(name, params)), renderTool((name) => resolveDoc(name), (n, p) => op(n, p)));
      await server.connect(new StdioServerTransport());
      await new Promise(() => {}); // run until the client closes stdin
      return 0;
    }
    case "pack": {
      need(1, "pack <system> [-o dir]");
      const p = pack(rest[0]);
      const o = flag<string>(flags, "out");
      if (o) {
        mkdirSync(o, { recursive: true });
        for (const f of ["SKILL.md", "AGENTS.md", "llms.txt", "catalog.txt"] as const) writeFileSync(join(o, f), p[f]);
        out(`wrote pack for ${rest[0]} to ${o}/`);
      } else if (ctx.json) printJson(p);
      else out(p["SKILL.md"]);
      return 0;
    }
    case "openapi": printJson(openapi()); return 0;
    case "agent-card": printJson(a2aCard()); return 0;
    case "mcp-tools": printJson(mcpTools()); return 0;

    default:
      err(`unknown command '${cmd}'. Run 'kages help'.`);
      return 1;
  }
}

interface KageSummary { name: string; title: string; system: string; version: number; state: string; visibility: string; blocks: number; validation: { ok: boolean; errors: number }; }
interface VersionSummary { v: number; state: string; digest: string; change: { summary: string }; author: { principal: string }; validation: { ok: boolean }; }

function kageTable(cards: KageSummary[]): string {
  return table(cards, [
    { header: "title", get: (c) => c.title },
    { header: "name", get: (c) => c.name },
    { header: "system", get: (c) => c.system },
    { header: "v", get: (c) => "v" + c.version },
    { header: "state", get: (c) => c.state },
    { header: "vis", get: (c) => c.visibility },
    { header: "blocks", get: (c) => String(c.blocks), align: "right" },
    { header: "valid", get: (c) => (c.validation.ok ? "✓" : `${c.validation.errors}✗`) },
  ]);
}

// search_kages returns full VersionRecords; map to the same card shape as list_kages.
function fromVersion(v: any): KageSummary {
  return { name: v.name, title: v.doc.title, system: v.resolved?.system ?? v.doc.system, version: v.v, state: v.state, visibility: v.visibility, blocks: Object.keys(v.doc.blocks).length, validation: v.validation };
}

function writeOut(flags: ParsedArgs["flags"], text: string): void {
  const o = flag<string>(flags, "out");
  if (o) { writeFileSync(o, text.endsWith("\n") ? text : text + "\n"); out(`wrote ${o}`); }
  else out(text);
}

function mcpInfo(remote: { email: string; apiUrl: string } | null, ctx: Ctx): number {
  const skills = Object.keys(systems).map((id) => "kages-" + id).join(", ");
  out("Kages MCP server");
  out(`  mode:      ${remote ? `cloud — signed in as ${remote.email} @ ${remote.apiUrl}` : `local — ${ctx.dir} (run \`kages mcp login\` for your cloud workspace)`}`);
  out(`  tools:     ${mcpTools().length} (the full operation set)`);
  out(`  skills:    ${skills} (served as MCP prompts)`);
  out("  resources: per-system catalogs + the agent card");
  out("  run:       kages mcp");
  out("  register:  claude mcp add kages -- kages mcp   |   codex mcp add kages -- kages mcp");
  return 0;
}

async function authCmd(rest: string[], flags: ParsedArgs["flags"]): Promise<number> {
  const sub = rest[0] ?? "status";
  if (sub === "login") { const email = await login(flag<string>(flags, "url")); out(`signed in as ${email}`); return 0; }
  if (sub === "logout") { logout(); out("signed out"); return 0; }
  if (sub === "status") { const s = status(); out(s ? `signed in as ${s.email} @ ${s.apiUrl}` : "not signed in"); return 0; }
  throw new Error("usage: kages auth <login|logout|status> [--url <deployment>]");
}
