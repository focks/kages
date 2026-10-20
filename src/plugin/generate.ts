// Every plugin artifact, generated from one source. A target is a harness's plugin
// format; `generatePlugins` returns EVERY file of EVERY target as path → content, so the
// build script just writes it and a test just compares it with what is committed: drift
// is impossible to commit by accident. Formats come from each harness's official docs
// (Claude Code: https://code.claude.com/docs/en/plugins-reference, Cursor:
// https://cursor.com/docs/reference/plugins), and a target with no verified format is not
// generated; it is listed under "planned" in plugins/README.md.
import { systems } from "../engine/data.ts";
import { skillMd } from "../packs/packs.ts";
import { systemCard } from "../packs/system-card.ts";
import { LAUNCHER_SH } from "../hooks/manifest.ts";
import { decisionSkillMd, DECISION_SKILL_NAME } from "../packs/decision-skill.ts";
import { loginSkillMd, LOGIN_SKILL_NAME } from "../packs/login-skill.ts";
import { VERSION } from "../version.ts";

export const DEFAULT_MCP_URL = "https://kages-focks-projects.vercel.app/api/mcp";
export interface PluginOptions { version?: string; mcpUrl?: string }
export type Files = Record<string, string>;
export interface Target { id: string; /** root directory of the target, relative to the repo */ dir: string; files: Files }

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";

/** Skills: one authoring guide per design system, plus the decision-guide and login skills. */
function skillFiles(): Files {
  const f: Files = {};
  for (const id of Object.keys(systems)) { f[`skills/kages-${id}/SKILL.md`] = skillMd(id); f[`skills/kages-${id}/reference/system.md`] = systemCard(id).markdown; }
  f[`skills/${DECISION_SKILL_NAME}/SKILL.md`] = decisionSkillMd();
  f[`skills/${LOGIN_SKILL_NAME}/SKILL.md`] = loginSkillMd();
  return f;
}

function claudeTarget(o: Required<PluginOptions>): Target {
  const files: Files = skillFiles();
  files["bin/kages-hook"] = LAUNCHER_SH;
  // ${CLAUDE_PLUGIN_ROOT} is the plugin's installed directory; quoted so a path with spaces stays one word.
  const cmd = (ev: string) => `"\${CLAUDE_PLUGIN_ROOT}"/bin/kages-hook --harness claude --event ${ev}`;
  files["hooks/hooks.json"] = json({ hooks: {
    PostToolUse: [{ matcher: "Edit|Write|MultiEdit", hooks: [{ type: "command", command: cmd("post"), timeout: 10 }] }],
    PreToolUse: [{ matcher: "Write", hooks: [{ type: "command", command: cmd("pre"), timeout: 10 }] }],
    Stop: [{ hooks: [{ type: "command", command: cmd("stop"), timeout: 20 }] }],
  } });
  files[".claude-plugin/plugin.json"] = json({
    name: "kages", version: o.version,
    description: "Author interactive Kages from an agent: the operation set as MCP tools, the per-system authoring guides, improvement moves and an edit hook.",
    author: { name: "Kages" }, homepage: "https://github.com/focks/kages", repository: "https://github.com/focks/kages", license: "MIT",
    keywords: ["kages", "mcp", "artifactory", "agents", "design-systems"],
    mcpServers: { kages: { type: "http", url: o.mcpUrl } },
  });
  files["README.md"] = `# Kages plugin

Everything you need to author, review and refine Kages from Claude Code, installed in one step (version ${o.version}):

- **MCP tools**: the full Kages operation set, served over the remote endpoint at \`${o.mcpUrl}\`.
- **Skills**: one authoring guide per design system (\`kages-core\`, \`kages-ledger\`, \`kages-atelier\`) with its system card, plus \`kages-decision-guide\` for turning a technical question into an interactive guide and \`kages-login\` for signing in to your workspace.
- **Hook**: checks \`*.kage.json\` files as they are edited and reports problems once (needs the \`kages\` CLI on your PATH; silent without it).

## Install

\`\`\`
/plugin marketplace add focks/kages
/plugin install kages@kages
\`\`\`

The first time, Claude Code asks you to approve the hook; review it with \`/hooks\`.

## Access level

Out of the box the endpoint is **anonymous**: you can read public Kages and try the tools against the demo workspace. To act on **your own** workspace:

- **Authenticated remote**: add an \`Authorization: Bearer <token>\` header to the \`kages\` server (token from \`kages auth login\` → \`~/.kages/config.json\`).
- **Local CLI (stdio)**: \`kages auth login\`, then \`claude mcp add kages -- kages mcp\`. It routes to your cloud workspace when signed in, else the local \`./.kages\`.

## Your own server

Build the plugin against a private deployment: \`KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins\`.

These files are generated from the engine; edit the sources in \`src/\`, never these, and regenerate with \`npm run build:plugins\`.
`;
  return { id: "claude", dir: "plugins/kages", files };
}

function cursorTarget(o: Required<PluginOptions>): Target {
  const files: Files = skillFiles();
  files["bin/kages-hook"] = LAUNCHER_SH;
  files[".cursor-plugin/plugin.json"] = json({ name: "kages", version: o.version, description: "Author interactive Kages from an agent: authoring guides per design system, improvement playbooks, MCP tools and an edit hook.", author: { name: "Kages" }, homepage: "https://github.com/focks/kages", repository: "https://github.com/focks/kages", license: "MIT", keywords: ["kages", "mcp", "agents", "design-systems"] });
  files["mcp.json"] = json({ mcpServers: { kages: { url: o.mcpUrl } } });
  files["hooks/hooks.json"] = json({ version: 1, hooks: {
    afterFileEdit: [{ command: "./bin/kages-hook --harness cursor --event post", timeout: 10 }],
    stop: [{ command: "./bin/kages-hook --harness cursor --event stop", timeout: 20 }],
  } });
  files["README.md"] = `# Kages for Cursor

Version ${o.version}. Skills (one per design system), the Kages MCP server (\`${o.mcpUrl}\`) and the edit hook (needs the \`kages\` CLI on your PATH; silent without it).

Generated from the Kages sources with \`npm run build:plugins\`; do not edit by hand.
`;
  return { id: "cursor", dir: "plugins/kages-cursor", files };
}

/** The marketplace index for the Claude target, one entry per plugin it lists. */
export function claudeMarketplace(o: Required<PluginOptions>): string {
  return json({ name: "kages", description: "Kages: an artifactory for agents.", owner: { name: "Kages", url: "https://github.com/focks/kages" }, plugins: [{ name: "kages", source: "./plugins/kages", description: "MCP tools for the Kages operation set, authoring skills for each design system, improvement moves and an edit hook.", version: o.version }] });
}

/** Everything, keyed by repo-relative path. Pure: no disk, no clock. */
export function generatePlugins(opts: PluginOptions = {}): { targets: Target[]; files: Files; planned: string[] } {
  const o = { version: opts.version ?? VERSION, mcpUrl: opts.mcpUrl ?? DEFAULT_MCP_URL };
  const targets = [claudeTarget(o), cursorTarget(o)];
  const files: Files = { ".claude-plugin/marketplace.json": claudeMarketplace(o) };
  for (const t of targets) for (const [p, c] of Object.entries(t.files)) files[`${t.dir}/${p}`] = c;
  files["plugins/README.md"] = pluginsReadme(o);
  return { targets, files, planned: ["vscode", "codex", "grok"] };
}

function pluginsReadme(o: Required<PluginOptions>): string {
  return `# Kages plugins

Generated from one source (\`src/plugin/generate.ts\`); regenerate with \`npm run build:plugins\` and verify with \`npm run check:plugins\`. Version ${o.version}.

| Harness | Directory | Install |
| --- | --- | --- |
| Claude Code | \`plugins/kages\` | \`/plugin marketplace add focks/kages\`, then \`/plugin install kages@kages\`; approve the hook with \`/hooks\` |
| Cursor | \`plugins/kages-cursor\` | Add the folder as a local plugin (it carries \`.cursor-plugin/plugin.json\`) |

**Planned, not generated:** VS Code (\`chat.pluginLocations\`), Codex and Grok. A target is added only after its current official plugin format is captured and validated; see \`src/plugin/generate.ts\`.

## Pointing at your own server

\`KAGES_PLUGIN_MCP_URL=<your server>/api/mcp npm run build:plugins\`. The plugin embeds no credentials: to act on your own workspace, supply a bearer token through your harness's MCP header or environment settings.

## Versions

\`package.json\` is the only version. Every manifest, the marketplace entry, \`kages --version\` and the installed files' \`kages-version\` come from it.
`;
}

/** Structural validation of a generated target, standing in for a harness validator where one is not installed. */
export function validateTarget(t: Target): string[] {
  const problems: string[] = [], has = (p: string) => p in t.files;
  const parse = (p: string): Record<string, unknown> | null => { try { return JSON.parse(t.files[p]) as Record<string, unknown>; } catch { problems.push(`${t.id}: ${p} is not valid JSON`); return null; } };
  const manifestPath = t.id === "claude" ? ".claude-plugin/plugin.json" : ".cursor-plugin/plugin.json";
  const m = has(manifestPath) ? parse(manifestPath) : (problems.push(`${t.id}: missing ${manifestPath}`), null);
  if (m) {
    if (typeof m.name !== "string" || !/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/.test(m.name)) problems.push(`${t.id}: name must be kebab-case`);
    if (typeof m.version !== "string" || !m.version) problems.push(`${t.id}: version is required`);
    if (/^(claude|anthropic)/i.test(String(m.name))) problems.push(`${t.id}: the name must not read as an Anthropic plugin`);
    for (const k of ["homepage", "repository"]) if (typeof m[k] === "string") { try { new URL(m[k] as string); } catch { problems.push(`${t.id}: ${k} must be a URL`); } }
  }
  for (const [p, c] of Object.entries(t.files)) {
    if (p.endsWith(".json")) parse(p);
    if (/^[A-Za-z]:|^\/|\.\./.test(p)) problems.push(`${t.id}: ${p} is not a relative path inside the plugin`);
    if (/\/home\/|\/Users\/|C:\\\\Users/.test(c)) problems.push(`${t.id}: ${p} contains a machine path`);
    if (/Bearer\s+[A-Za-z0-9._-]{16,}|sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_-]{20,}/.test(c)) problems.push(`${t.id}: ${p} looks like it contains a credential`);
  }
  for (const [p, c] of Object.entries(t.files)) if (p.startsWith("skills/") && p.endsWith("SKILL.md") && !/^---\nname: [a-z0-9-]+\ndescription: .+\n---\n/.test(c.replace(/^---\nkages-version: .*\n/, "---\n"))) problems.push(`${t.id}: ${p} frontmatter must start with name and description`);
  for (const p of Object.keys(t.files).filter((x) => x.startsWith("agents/") || x.startsWith("commands/"))) if (!/^---\n[\s\S]*?\n---\n/.test(t.files[p]) || !/description: .+/.test(t.files[p])) problems.push(`${t.id}: ${p} needs frontmatter with a description`);
  // Every command a hook runs must exist in the plugin.
  for (const hp of ["hooks/hooks.json"]) if (has(hp)) for (const m2 of t.files[hp].matchAll(/(bin\/[A-Za-z0-9._-]+)/g)) if (!has(m2[1])) problems.push(`${t.id}: ${hp} runs ${m2[1]}, which is not in the plugin`);
  return problems;
}
