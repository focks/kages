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

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { systems, contracts } from "../engine/data.ts";
import { catalog } from "../engine/catalog.ts";
import { validate } from "../engine/validate.ts";
import { review } from "../engine/advice.ts";
import { outlineToKage } from "../engine/outline.ts";
import { describe } from "../engine/describe.ts";
import { generationSchema, fromGenerated, toGenerated } from "../engine/generate.ts";
import { KageSession } from "../engine/session.ts";
import { dispatch, isWriteOp, type OpContext, type OpResult } from "../adapters/operations.ts";
import { openapi, a2aCard, mcpTools } from "../adapters/surfaces.ts";
import { setupCmd } from "./setup.ts";
import { pack } from "../packs/packs.ts";
import { loadStore, saveStore, owner, workspaceDir, initWorkspace } from "./workspace.ts";
import { login, logout, status, remoteCall } from "./auth.ts";
import { parseArgs, flag, type ParsedArgs } from "./args.ts";
import { printJson, table, out, err } from "./format.ts";
import type { KageDoc } from "../engine/types.ts";

const VERSION = "1.0.0";

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
  describe <file|name> [-s sys] text view for agents
  preview  <file|name> [-s sys] headless render snapshot (visibility + outputs)
  convert  <file> --to envelope|doc [-s sys]
  from-markdown <file.md> [-o out.kage.json] [--title t] [--id i] [-s sys] [--toc auto|always|never] [--create]
                                write prose, get a Kage: headings → sections, > Note → alerts,
                                tables, adjacent code → tabs, FAQ → accordion, 3+ sections → contents

manage  (your CLOUD workspace when signed in, else the local ./.kages; --local forces local)
  init                          create the local workspace
  create <file> [--repo r]      store a new Kage (validated + signed)
  patch  <name> <patch.json>    apply RFC 6902 ops, new version
  ls [-s sys] [--state st]      list stored Kages
  get <name> [-v n] [-o file]   print a stored Kage document
  versions <name>               revision history with provenance
  search <query> [-s sys]       full-text search
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

setup  (wire Kages into a coding harness)
  setup skills [--harness claude|codex] ...
                                install the authoring skills (one per system)

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

  if (!cmd || cmd === "help" || flags.help) { out(HELP); return 0; }
  if (cmd === "version" || (flags.version === true && !cmd)) { out(`kages ${VERSION}`); return 0; }

  try {
    return await run(cmd, rest, flags, { json, dir });
  } catch (e) {
    err(`error: ${(e as Error).message}`);
    return 1;
  }
}

interface Ctx { json: boolean; dir: string; }

async function run(cmd: string, rest: string[], flags: ParsedArgs["flags"], ctx: Ctx): Promise<number> {
  const sys = flag<string>(flags, "system");
  const need = (n: number, usage: string) => { if (rest.length < n) throw new Error(`usage: kages ${usage}`); };

  // Resolve a Kage from a file path, or (failing that) a stored name.
  const resolveDoc = (target: string): KageDoc => {
    if (target && existsSync(target)) return JSON.parse(readFileSync(target, "utf8")) as KageDoc;
    const head = loadStore(ctx.dir).head(target);
    if (head) return head.doc;
    throw new Error(`no file or stored Kage '${target}'`);
  };

  // Run an operation. Signed in (and not --local) → against your CLOUD workspace
  // over the network; otherwise against the local ./.kages store (persist if it
  // mutated and succeeded). So after `kages auth login`, `kages ls` lists your
  // cloud Kages; `--local` always uses the on-disk workspace.
  const useRemote = !flags.local && !!status();
  const op = async (name: string, params: Record<string, unknown>, mutates = false): Promise<OpResult> => {
    if (useRemote) {
      try { return { ok: true, data: await remoteCall(name, params) }; }
      catch (e) { return { ok: false, error: { code: "remote", msg: (e as Error).message } }; }
    }
    const store = loadStore(ctx.dir);
    const opCtx: OpContext = { store, author: owner(), repo: flag(flags, "repo") };
    const r = dispatch(opCtx, name, params);
    if (r.ok && mutates) saveStore(ctx.dir, store);
    return r;
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
    case "describe": { need(1, "describe <file|name> [-s system]"); out(describe(resolveDoc(rest[0]), sys)); return 0; }
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
    case "init": { initWorkspace(ctx.dir); out(`initialized workspace at ${ctx.dir}`); return 0; }
    case "from-markdown": {
      need(1, "from-markdown <file.md> [-o out.kage.json] [--title t] [--id i] [-s sys] [--toc auto|always|never] [--create]");
      const built = outlineToKage(readFileSync(rest[0], "utf8"), { title: flag<string>(flags, "title"), id: flag<string>(flags, "id"), system: sys, toc: flag<"auto" | "always" | "never">(flags, "toc") });
      const r = review(built.doc, sys?.split("@")[0]);
      if (ctx.json) { printJson({ doc: built.doc, notes: built.notes, stats: built.stats, validation: { ok: r.ok, errors: r.errors, warnings: r.warnings }, advice: r.advice }); return r.ok ? 0 : 1; }
      for (const n of built.notes) process.stderr.write(`  • ${n}\n`);
      for (const a of r.advice) process.stderr.write(`  ${a.level === "lint" ? "◦" : "→"} ${a.at}  ${a.fix ?? a.msg}\n`);
      if (!r.ok) { for (const e of r.errors) process.stderr.write(`  ✗ ${e.at}  ${e.code}  ${e.msg}\n`); return 1; }
      if (flags.create) return report(await op("create_kage", { doc: built.doc }, true), (d) => out(`created ${(d as any).version.ref}`));
      writeOut(flags, JSON.stringify(built.doc, null, 2));
      return 0;
    }
    case "create": {
      need(1, "create <file> [--repo r]");
      const doc = JSON.parse(readFileSync(rest[0], "utf8"));
      return report(await op("create_kage", { doc }, true), (d) => out(`created ${(d as any).version.ref}`));
    }
    case "patch": {
      need(2, "patch <name> <patch.json>");
      const ops = JSON.parse(readFileSync(rest[1], "utf8"));
      return report(await op("patch_kage", { name: rest[0], ops }, true), (d) => out(`patched → ${(d as any).version.ref}`));
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
      return setupCmd(rest, harnesses);
    }

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
      const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
      const server = createMcpServer((name, params) => op(name, params, isWriteOp(name)));
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
