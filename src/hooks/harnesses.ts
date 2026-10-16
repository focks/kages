// One entry per coding harness: how to recognise its hook payload, which files an edit
// touched, and how to speak back to it. This is DATA, captured from each harness's
// official documentation (see __fixtures__/README.md for sources and the date), because
// these formats change and an adapter built from memory fails silently. Each entry
// carries `lastVerified` so `kages doctor` can say when it is going stale. Grok has no
// verified schema, so it has no entry.
export type HookEvent = "post" | "pre" | "stop";
export type HarnessId = "claude" | "cursor" | "codex" | "copilot";

export interface Payload { [k: string]: unknown }
export interface Harness {
  id: HarnessId;
  detect(p: Payload): boolean;
  event(p: Payload): HookEvent | null;
  /** Paths an edit event touched, as the harness reported them (may be relative). */
  targets(p: Payload): string[];
  /** Content a PRE event proposes to write for a path, when the harness provides it in full. */
  proposed?(p: Payload): { path: string; content: string } | null;
  /** The harness's stdout for text to show the agent after an edit. */
  addContext(text: string, event: HookEvent, p: Payload): string;
  /** Deny a proposed write (pre events). Absent = this harness cannot deny from here. */
  deny?(reason: string): string;
  /** Ask the agent to keep going when the turn ends with open findings. Absent = just add context. */
  continueTurn?(text: string, p: Payload): string;
  docsUrl: string;
  lastVerified: string;
}

const str = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);
const obj = (v: unknown): Payload => (v && typeof v === "object" && !Array.isArray(v) ? (v as Payload) : {});

/** File paths named anywhere in a tool's arguments: file_path, path, filePath and edits[].file_path. */
function pathsIn(input: unknown): string[] {
  const o = obj(input), out: string[] = [];
  for (const k of ["file_path", "path", "filePath", "target_file"]) { const s = str(o[k]); if (s) out.push(s); }
  if (Array.isArray(o.edits)) for (const e of o.edits) { const s = str(obj(e).file_path); if (s) out.push(s); }
  return [...new Set(out)];
}

const ctxJson = (event: string, text: string) => JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } });

export const claude: Harness = {
  id: "claude",
  detect: (p) => typeof p.hook_event_name === "string" && /^(PostToolUse|PreToolUse|Stop)$/.test(p.hook_event_name as string) && !("tool_result" in p) && !("turn_id" in p),
  event: (p) => (p.hook_event_name === "PostToolUse" ? "post" : p.hook_event_name === "PreToolUse" ? "pre" : p.hook_event_name === "Stop" ? "stop" : null),
  targets: (p) => pathsIn(p.tool_input),
  proposed: (p) => { const i = obj(p.tool_input), path = str(i.file_path), content = str(i.content); return p.tool_name === "Write" && path && content !== undefined ? { path, content } : null; },
  addContext: (text, event) => ctxJson(event === "pre" ? "PreToolUse" : event === "stop" ? "Stop" : "PostToolUse", text),
  deny: (reason) => JSON.stringify({ hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason } }),
  // A Stop hook that blocks makes Claude continue; stop_hook_active stops that from looping forever.
  continueTurn: (text, p) => (p.stop_hook_active ? ctxJson("Stop", text) : JSON.stringify({ decision: "block", reason: text })),
  docsUrl: "https://code.claude.com/docs/en/hooks", lastVerified: "2026-10-16",
};

export const cursor: Harness = {
  id: "cursor",
  detect: (p) => "conversation_id" in p && ("cursor_version" in p || "workspace_roots" in p),
  event: (p) => (p.hook_event_name === "afterFileEdit" || p.hook_event_name === "afterTabFileEdit" || p.hook_event_name === "postToolUse" ? "post" : p.hook_event_name === "stop" ? "stop" : null),
  targets: (p) => { const s = str(p.file_path); return s ? [s] : pathsIn(p.tool_input); },
  addContext: (text) => JSON.stringify({ additional_context: text }),
  continueTurn: (text) => JSON.stringify({ followup_message: text }),
  docsUrl: "https://cursor.com/docs/agent/hooks", lastVerified: "2026-10-16",
};

/** apply_patch carries a patch, not a path: files are named on `*** Add|Update File:` lines. */
export function patchFiles(patch: string): string[] {
  return [...patch.matchAll(/^\*\*\* (?:Add|Update) File: (.+)$/gm)].map((m) => m[1].trim());
}

export const codex: Harness = {
  id: "codex",
  detect: (p) => "turn_id" in p || p.tool_name === "apply_patch",
  event: (p) => (p.hook_event_name === "PostToolUse" ? "post" : p.hook_event_name === "PreToolUse" ? "pre" : p.hook_event_name === "Stop" ? "stop" : null),
  targets: (p) => (p.tool_name === "apply_patch" ? patchFiles(str(obj(p.tool_input).command) ?? "") : pathsIn(p.tool_input)),
  addContext: (text, event) => ctxJson(event === "stop" ? "Stop" : "PostToolUse", text),
  docsUrl: "https://learn.chatgpt.com/docs/hooks", lastVerified: "2026-10-16",
};

export const copilot: Harness = {
  id: "copilot",
  detect: (p) => ("toolName" in p && "sessionId" in p) || (p.hook_event_name === "PostToolUse" && "tool_result" in p),
  event: (p) => ("toolResult" in p || "tool_result" in p ? "post" : "toolName" in p || "tool_name" in p ? "pre" : null),
  targets: (p) => pathsIn(p.toolArgs ?? p.tool_input),
  // camelCase output is `additionalContext`; the VS Code-compatible form is also given the Claude shape.
  addContext: (text, event, p) => JSON.stringify("tool_result" in p ? { additionalContext: text, hookSpecificOutput: { hookEventName: "PostToolUse", additionalContext: text } } : { additionalContext: text }),
  docsUrl: "https://docs.github.com/en/copilot/reference/hooks-reference", lastVerified: "2026-10-16",
};

/** Order matters: the more specific shapes first, Claude (the broadest) last. */
export const HARNESSES: readonly Harness[] = [cursor, codex, copilot, claude];

export function detectHarness(p: Payload, forced?: string): Harness | undefined {
  if (forced) return HARNESSES.find((h) => h.id === forced);
  return HARNESSES.find((h) => h.detect(p));
}
