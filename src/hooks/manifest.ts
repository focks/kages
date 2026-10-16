// Editing a harness's hook configuration is editing executable config, so it is done as
// a pure, reversible plan: string in, string out, with a diff to show before anything is
// written. We add or replace ONLY our own entry (recognised by the launcher name in its
// command), keep every other key and entry, and uninstalling removes exactly what we
// added. The shapes come from each harness's official documentation (see
// __fixtures__/README.md); a harness without a verified shape has no entry here.
import type { HarnessId } from "./harnesses.ts";

export type Scope = "project" | "global";
export const MARKER = "kages-hook";

export interface Target { relPath: string; /** a file Kages owns outright (deleted on uninstall) */ owned?: boolean }

/** Where each harness reads hooks, per scope. null = no verified location for that scope. */
export const MANIFESTS: Record<HarnessId, { project: Target | null; global: Target | null; trust: string }> = {
  claude: { project: { relPath: ".claude/settings.local.json" }, global: { relPath: ".claude/settings.json" }, trust: "Claude Code asks you to approve new hooks the first time; review them with /hooks." },
  cursor: { project: { relPath: ".cursor/hooks.json" }, global: null, trust: "Cursor runs project hooks from .cursor/hooks.json; restart the agent after installing." },
  codex: { project: { relPath: ".codex/hooks.json" }, global: { relPath: ".codex/hooks.json" }, trust: "Codex asks you to review and trust new hooks: open /hooks and approve the Kages entry." },
  copilot: { project: { relPath: ".github/hooks/kages.json", owned: true }, global: { relPath: ".copilot/hooks/kages.json", owned: true }, trust: "Copilot cloud agent reads .github/hooks/*.json from the repository, so commit this file for it to apply; Copilot CLI also reads it locally." },
};

export interface PlanInput { harness: HarnessId; /** the launcher command as it should appear in the config */ command: (event: "post" | "pre" | "stop") => string }
export interface Plan { after: string | null; changed: boolean; actions: string[] }

const isOurs = (cmd: unknown) => typeof cmd === "string" && cmd.includes(MARKER);

function indentOf(text: string): string | number { const m = /^\{\r?\n([ \t]+)"/.exec(text); return m ? (m[1].includes("\t") ? "\t" : m[1].length) : 2; }
const emit = (obj: unknown, like: string | null): string => JSON.stringify(obj, null, like ? indentOf(like) : 2) + "\n";

type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const asList = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** The nested { matcher?, hooks:[{type,command}] } shape shared by Claude Code and Codex. */
function nestedGroups(groups: unknown, matcher: string | undefined, command: string, extra: Obj): unknown[] {
  return [...stripNested(groups), { ...(matcher ? { matcher } : {}), hooks: [{ type: "command", command, ...extra }] }];
}
function stripNested(groups: unknown): unknown[] {
  return asList(groups).map((g) => ({ ...asObj(g), ...(asObj(g).hooks ? { hooks: asList(asObj(g).hooks).filter((h) => !isOurs(asObj(h).command)) } : {}) })).filter((g) => !Array.isArray(g.hooks) || g.hooks.length > 0);
}
const flatList = (list: unknown, entry: Obj): unknown[] => [...asList(list).filter((h) => !isOurs(asObj(h).command) && !isOurs(asObj(h).bash)), entry];
const stripFlat = (list: unknown): unknown[] => asList(list).filter((h) => !isOurs(asObj(h).command) && !isOurs(asObj(h).bash));

function setEvent(hooks: Obj, name: string, value: unknown[]): void { if (value.length) hooks[name] = value; else delete hooks[name]; }

/** Parse the existing file. Throws a message naming the problem when it is not a JSON object. */
export function parseExisting(text: string | null, label: string): Obj {
  if (text === null || text.trim() === "") return {};
  let v: unknown;
  try { v = JSON.parse(text); } catch (e) { throw new Error(`${label} is not valid JSON (${(e as Error).message})`); }
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`${label} must be a JSON object`);
  return v as Obj;
}

export function planInstall(i: PlanInput, existing: string | null, label = "the hook file"): Plan {
  const root = parseExisting(existing, label);
  const hooks = asObj(root.hooks);
  const actions: string[] = [];
  switch (i.harness) {
    case "claude":
      setEvent(hooks, "PostToolUse", nestedGroups(hooks.PostToolUse, "Edit|Write|MultiEdit", i.command("post"), { timeout: 10 }));
      setEvent(hooks, "PreToolUse", nestedGroups(hooks.PreToolUse, "Write", i.command("pre"), { timeout: 10 }));
      setEvent(hooks, "Stop", nestedGroups(hooks.Stop, undefined, i.command("stop"), { timeout: 20 }));
      actions.push("PostToolUse (Edit, Write, MultiEdit)", "PreToolUse (Write)", "Stop");
      break;
    case "codex":
      setEvent(hooks, "PostToolUse", nestedGroups(hooks.PostToolUse, "apply_patch", i.command("post"), { statusMessage: "Checking Kages" }));
      setEvent(hooks, "Stop", nestedGroups(hooks.Stop, undefined, i.command("stop"), { timeout: 30 }));
      actions.push("PostToolUse (apply_patch)", "Stop");
      break;
    case "cursor":
      setEvent(hooks, "afterFileEdit", flatList(hooks.afterFileEdit, { command: i.command("post"), timeout: 10 }));
      setEvent(hooks, "stop", flatList(hooks.stop, { command: i.command("stop"), timeout: 20 }));
      if (root.version === undefined) root.version = 1;
      actions.push("afterFileEdit", "stop");
      break;
    case "copilot":
      setEvent(hooks, "postToolUse", flatList(hooks.postToolUse, { type: "command", bash: i.command("post"), cwd: ".", timeoutSec: 30 }));
      if (root.version === undefined) root.version = 1;
      actions.push("postToolUse");
      break;
  }
  root.hooks = hooks;
  const after = emit(root, existing);
  return { after, changed: after !== existing, actions };
}

/** Remove only our entries. Returns after:null when nothing but our entries (and scaffolding) was in the file. */
export function planUninstall(harness: HarnessId, existing: string | null, label = "the hook file"): Plan {
  if (existing === null) return { after: null, changed: false, actions: [] };
  const root = parseExisting(existing, label);
  const hooks = asObj(root.hooks);
  for (const name of Object.keys(hooks)) {
    const v = hooks[name];
    const stripped = harness === "claude" || harness === "codex" ? stripNested(v) : stripFlat(v);
    setEvent(hooks, name, stripped);
  }
  if (Object.keys(hooks).length) root.hooks = hooks; else delete root.hooks;
  // `version: 1` is scaffolding we add to Cursor and Copilot files; without other content the file was ours.
  const others = Object.keys(root).filter((k) => !(k === "version" && (harness === "cursor" || harness === "copilot")));
  if (!Object.keys(hooks).length && others.length === 0) return { after: null, changed: true, actions: ["removed the Kages hooks"] };
  const after = emit(root, existing);
  return { after, changed: after !== existing, actions: after !== existing ? ["removed the Kages hooks"] : [] };
}

/** A small line diff for showing a plan: lines only in `a` are `-`, only in `b` are `+`. */
export function lineDiff(a: string | null, b: string | null): string {
  const A = (a ?? "").split("\n"), B = (b ?? "").split("\n");
  const m = A.length, n = B.length;
  const L: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out: string[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) { if (A[i] === B[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) out.push("- " + A[i++]); else out.push("+ " + B[j++]); }
  while (i < m) out.push("- " + A[i++]);
  while (j < n) out.push("+ " + B[j++]);
  return out.filter((l) => l.trim() !== "-" && l.trim() !== "+").join("\n");
}

/** The launcher: runs the real CLI when it exists and otherwise does nothing, silently. A missing
 *  binary must never turn every edit into an error. */
export const LAUNCHER_SH = `#!/bin/sh
# Kages edit hook launcher (generated by \`kages setup hooks\`).
# Runs the real CLI if it can be found; otherwise exits silently so a missing install never breaks an edit.
if command -v kages >/dev/null 2>&1; then exec kages hook "$@"; fi
for c in "./node_modules/.bin/kages" "$HOME/.local/bin/kages"; do
  if [ -x "$c" ]; then exec "$c" hook "$@"; fi
done
exit 0
`;
export const LAUNCHER_CMD = `@echo off\r\nrem Kages edit hook launcher (generated by \`kages setup hooks\`).\r\nwhere kages >nul 2>nul && (kages hook %* & exit /b 0)\r\nexit /b 0\r\n`;
