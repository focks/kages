// `kages critique <name>`: build the evidence packet for a design critique, with
// optional render evidence from the screenshot engine. Rendering is best effort:
// without Chrome or a running app the packet is still returned and says why the
// render is missing, so the critique never blocks on tooling.
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { KageDoc } from "../engine/types.ts";
import type { CritiquePacket, RenderEvidence } from "../packs/critique-packet.ts";
import { PROTOCOL } from "../packs/critique-protocol.ts";
import { ensureRuntimeDir } from "./gitignore.ts";
import { out, printJson } from "./format.ts";
import { parseWidths } from "./screenshot.ts";

export interface Shot { width: number; height: number; png: Buffer; issues: string[] }
export type Shoot = (doc: KageDoc, opts: { widths: number[]; dark: boolean }) => Promise<Shot[]>;

export async function gatherRender(doc: KageDoc, name: string, dir: string, flags: Record<string, unknown>, shoot: Shoot): Promise<RenderEvidence | undefined> {
  if (flags.screens === undefined) return undefined;
  const widths = parseWidths(flags.screens);
  try {
    const shots = await shoot(doc, { widths, dark: flags.dark === true });
    const folder = join(dir, "screenshots");
    ensureRuntimeDir(folder);
    const paths = shots.map((s) => { const p = join(folder, `${name}-${s.width}${flags.dark === true ? "-dark" : ""}.png`); writeFileSync(p, s.png); return p; });
    return { widths: shots.map((s) => s.width), findings: shots.flatMap((s) => s.issues.map((i) => `${s.width}px: ${i}`)), shots: paths };
  } catch (e) {
    return { widths, findings: [], unavailable: `render failed: ${(e as Error).message}` };
  }
}

export function printPacket(p: CritiquePacket, json: boolean): void {
  if (json) { printJson(p); return; }
  const t = p.target, e = p.evidence;
  out(`Critique packet for ${t.name} v${t.version} (${t.system}) · mode ${t.mode ?? "unknown"} (${t.modeSource})`);
  out(`blocks ${e.stats.blocks}, depth ${e.stats.depth}, interactive ${e.stats.interactive}, state keys ${e.stats.stateKeys} · ${e.validation.errors} error(s), ${e.validation.warnings} warning(s)`);
  out(`findings: ${e.findings.length}${e.findings.slice(0, 8).map((f) => `\n  ${f.severity ?? "-"} ${f.at}  ${f.code}  ${f.msg}`).join("")}`);
  const r = e.render as { widths?: number[]; findings?: string[]; shots?: string[]; unavailable?: string };
  out(r.unavailable ? `render: unavailable (${r.unavailable})` : `render: ${r.widths?.join(", ")}px, ${r.findings?.length ?? 0} finding(s)${r.shots?.length ? `\n  ${r.shots.join("\n  ")}` : ""}`);
  out(`brief: workspace ${p.briefs.workspace ? "set" : "none"}, Kage ${p.briefs.kage ? "set" : "none"} · comments: ${e.comments.openThreads} open thread(s)`);
  out("\n" + PROTOCOL);
}
