// The files `kages install` writes, as a pure list: path, content, and what kind of thing
// it is. Everything is generated from the same sources the packs and the plugin use, so
// an installed skill can never say something the CLI does not do. Providers without a
// verified location for a kind of file get nothing for it; the plan says so.
import { decisionSkillMd, DECISION_SKILL_NAME } from "../packs/decision-skill.ts";
import { loginSkillMd, LOGIN_SKILL_NAME } from "../packs/login-skill.ts";
import { join } from "node:path";
import { systems } from "../engine/data.ts";
import { skillMd } from "../packs/packs.ts";
import { VERSION } from "../version.ts";

export type ProviderId = "claude" | "codex";
export const SKILL_PROVIDERS: ProviderId[] = ["claude", "codex"];
export type Kind = "skill" | "agent" | "command" | "reference";
export interface Planned { path: string; content: string; kind: Kind; provider: ProviderId }

/** The installed copy carries its version, so `kages check` can tell an old install from a hand edit. */
export const stamp = (md: string): string => md.replace(/^---\n/, `---\nkages-version: ${VERSION}\n`);

export function filesFor(provider: ProviderId, scope: "project" | "global", base: { project: string; home: string }): { files: Planned[]; notes: string[] } {
  const notes: string[] = [];
  const root = scope === "global" ? base.home : base.project;
  const files: Planned[] = [];
  if (provider === "claude") {
    const skills = join(root, ".claude", "skills");
    for (const id of Object.keys(systems)) files.push({ path: join(skills, `kages-${id}`, "SKILL.md"), content: stamp(skillMd(id)), kind: "skill", provider });
    files.push({ path: join(skills, DECISION_SKILL_NAME, "SKILL.md"), content: stamp(decisionSkillMd()), kind: "skill", provider });
    files.push({ path: join(skills, LOGIN_SKILL_NAME, "SKILL.md"), content: stamp(loginSkillMd()), kind: "skill", provider });
  } else if (provider === "codex") {
    if (scope === "project") notes.push("codex: prompts are only read from your home directory, so nothing is installed at project scope");
    else for (const id of Object.keys(systems)) files.push({ path: join(base.home, ".codex", "prompts", `kages-${id}.md`), content: stamp(skillMd(id)), kind: "skill", provider });
  }
  return { files, notes };
}

/** What to run to wire the tools, per provider. Printed, never executed. */
export const MCP_ADD: Record<string, string> = { claude: "claude mcp add kages -- kages mcp", codex: "codex mcp add kages -- kages mcp" };
export const HOSTED_MCP = "https://kages-focks-projects.vercel.app/api/mcp";
