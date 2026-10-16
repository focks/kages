// Run the checks and shape the report. `doctor` never repairs drift as a side effect of
// anything else; `--fix` applies only the findings marked safe, and a second run is empty.
import { CHECKS } from "./checks.ts";
import type { DoctorCtx, DoctorFinding, DoctorReport, Severity } from "./types.ts";

export const SEVERITY_ORDER: Record<Severity, number> = { route: 0, mention: 1, auto: 2 };

export async function runDoctor(ctx: DoctorCtx, opts: { areas?: string[]; ignore?: readonly string[] } = {}): Promise<DoctorReport> {
  const findings: DoctorFinding[] = [], ran: string[] = [];
  for (const c of CHECKS) {
    if (opts.areas?.length && !opts.areas.includes(c.area)) continue;
    ran.push(c.area);
    try { findings.push(...(await c.run(ctx))); }
    catch (e) { findings.push({ id: "doctor-check-failed", severity: "mention", area: c.area as DoctorFinding["area"], message: `The ${c.area} check could not run: ${(e as Error).message}` }); }
  }
  const ignored = new Set(opts.ignore ?? []);
  return { version: 1, ran, findings: findings.filter((f) => !ignored.has(f.id)).sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.area.localeCompare(b.area) || a.id.localeCompare(b.id)) };
}

/** The cheap subset that `kages context` can afford on every call: file stats only, no
 *  network, no store walk. It answers one question: is something stale enough to mention? */
export async function doctorLite(ctx: DoctorCtx): Promise<DoctorFinding[]> {
  const r = await runDoctor({ ...ctx, ping: undefined }, { areas: ["config", "gitignore", "hooks", "bundle"] });
  return r.findings.filter((f) => f.severity !== "mention" || f.id.startsWith("config"));
}

export function formatDoctor(report: DoctorReport): string {
  if (!report.findings.length) return `✓ No drift found (${report.ran.join(", ")}).`;
  const icon: Record<Severity, string> = { route: "✗", mention: "!", auto: "·" };
  const lines: string[] = [];
  let area = "";
  for (const f of report.findings) {
    if (f.area !== area) { area = f.area; lines.push(`\n${area}`); }
    lines.push(`  ${icon[f.severity]} ${f.id}: ${f.message}`);
    if (f.evidence) lines.push(`      ${f.evidence}`);
    if (f.fix) lines.push(`      → ${f.fix.command}${f.fix.safe ? "   (doctor --fix does this)" : ""}`);
  }
  const n = (s: Severity) => report.findings.filter((f) => f.severity === s).length;
  lines.push(`\n${n("route")} to act on, ${n("mention")} to know about, ${n("auto")} that fix themselves.`);
  return lines.join("\n").trimStart();
}
