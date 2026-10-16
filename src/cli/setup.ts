// `kages setup skills` — install the Kages authoring skills (the same packs the
// MCP server exposes as prompts) into a coding harness, so an agent there can
// author Kages. One skill per design system. MCP has no skill primitive, so
// each harness loads these from its own filesystem convention:
//   claude → ~/.claude/skills/kages-<system>/SKILL.md   (Claude Code skills)
//   codex  → ~/.codex/prompts/kages-<system>.md         (Codex prompts)
// We only ever write skill files; wiring the MCP *server* is one documented
// command per harness (printed at the end) — safer than editing their configs.

import { writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { systems } from "../engine/data.ts";
import { pack } from "../packs/packs.ts";
import { out, err } from "./format.ts";
import { ALL_HARNESSES, setupHooks } from "../hooks/install.ts";
import type { HarnessId } from "../hooks/harnesses.ts";
import { createInterface } from "node:readline/promises";
import { setKey } from "../config/write.ts";

interface Harness {
  // Absolute path to write the skill for `systemId`, and the dirs it needs.
  file: (systemId: string) => { dir: string; path: string };
  // The official one-liner that registers the `kages mcp` stdio server.
  mcpAdd: string;
}

const HARNESSES: Record<string, Harness> = {
  claude: {
    file: (id) => {
      const dir = join(homedir(), ".claude", "skills", `kages-${id}`);
      return { dir, path: join(dir, "SKILL.md") };
    },
    mcpAdd: "claude mcp add kages -- kages mcp",
  },
  // ponytail: Codex prompts dir — stable and simple today. Codex's newer Skills
  // location isn't a documented stable path yet; move here when it is.
  codex: {
    file: (id) => {
      const dir = join(homedir(), ".codex", "prompts");
      return { dir, path: join(dir, `kages-${id}.md`) };
    },
    mcpAdd: "codex mcp add kages -- kages mcp",
  },
};

function installSkills(harnessId: string): string[] {
  const h = HARNESSES[harnessId];
  if (!h) throw new Error(`unknown harness '${harnessId}' (known: ${Object.keys(HARNESSES).join(", ")})`);
  return Object.keys(systems).map((id) => {
    const { dir, path } = h.file(id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, pack(id)["SKILL.md"]);
    return path;
  });
}

/** `kages setup skills --harness claude --harness codex`. */
export function setupSkills(harnesses: string[]): number {
  for (const id of harnesses) {
    const paths = installSkills(id);
    out(`${id}: installed ${paths.length} Kages skills`);
    for (const p of paths) out(`  ${p}`);
    out(`  then wire the tools: ${HARNESSES[id].mcpAdd}`);
  }
  return 0;
}

/** `kages setup hooks`: see src/hooks/install.ts. */
async function setupHooksCmd(harnesses: string[], flags: Record<string, unknown>, workspace: string): Promise<number> {
  const ids = (harnesses.length ? harnesses.flatMap((h) => h.split(",")) : ["claude"]) as HarnessId[];
  for (const h of ids) if (!ALL_HARNESSES.includes(h)) { err(`unknown harness '${h}' for hooks (${ALL_HARNESSES.join(", ")}; grok has no verified hook format yet)`); return 1; }
  const scope = flags.scope === "global" ? "global" : "project";
  const tty = !!process.stdin.isTTY && !flags.yes;
  const rl = tty ? createInterface({ input: process.stdin, output: process.stderr }) : null;
  try {
    const r = await setupHooks({
      harnesses: ids, scope, projectDir: process.cwd(), homeDir: homedir(),
      dryRun: flags["dry-run"] === true, yes: flags.yes === true, force: flags.force === true, uninstall: flags.uninstall === true, noHooks: flags["no-hooks"] === true,
      confirm: rl ? async (q) => !/^n/i.test((await rl.question(`${q} [Y/n] `)).trim()) : undefined,
      recordConsent: (v) => { try { setKey(join(workspace, "config.local.json"), "hook.consent", v); } catch { /* consent memory is a courtesy */ } },
    });
    for (const l of r.lines) out(l);
    return r.exit;
  } finally { rl?.close(); }
}

/** Dispatch the `setup` toolset. */
export function setupCmd(rest: string[], harnesses: string[], flags: Record<string, unknown> = {}, workspace = ".kages"): number | Promise<number> {
  if (rest[0] === "hooks") return setupHooksCmd(harnesses, flags, workspace);
  if (rest[0] !== "skills") { err("usage: kages setup skills [--harness claude|codex] ... | kages setup hooks [--harness claude,cursor,codex,copilot] [--scope project|global] [--dry-run] [--yes] [--force] [--uninstall] [--no-hooks]"); return 1; }
  return setupSkills(harnesses.length ? harnesses : ["claude"]);
}
