// The diagnostic bundle: typed fields in, markdown out. Nothing here reads the disk, the
// environment or the network; collectors (src/cli/report-cmd.ts) gather the facts and hand
// them over, so the allow-list is visible in one type. Free text enters only through
// `kage.doc` (opt-in) and the doctor/config messages, which the second redaction pass scrubs.
import { isSecretName, redactDetailed, type RedactClass } from "./redact.ts";

export interface ReportInput {
  versions: { kages: string; node: string; platform: string; arch: string; packageManager: string; install: "bundle" | "source" };
  /** From .kages/install.json: what was installed, never the file list. */
  install: { version: string; scope: string; providers: string[]; hooks: string[] } | null;
  /** Names only: whether each is set. */
  env: Record<string, boolean>;
  config: { entries: { key: string; layer: string; value?: unknown }[]; problems: string[] };
  doctor: { ran: string[]; findings: { id: string; severity: string; area: string; message: string }[] } | null;
  harness: { detected: string[]; hooksInstalled: string[] };
  kage?: {
    name: string; system: string; versions: number; blocks: number; histogram: Record<string, number>;
    validation: { errors: { code: string; at: string }[]; warnings: { code: string; at: string }[] };
    lint: { rule: string; severity: string; at: string }[];
    /** Present only with --include-doc, already confirmed. */
    doc?: string;
  };
  adviceLog: { calls: number; writes: number; writesWithRegressions: number } | null;
}

export interface BundleOptions { includeConfigValues?: boolean; home?: string; extraSecrets?: string[]; docLimit?: number }
export interface Bundle { markdown: string; excluded: string[]; redactions: Partial<Record<RedactClass, number>> }

export const DOC_LIMIT = 50 * 1024;
const fence = (s: string, lang = "") => { const f = s.includes("```") ? "~~~~" : "```"; return `${f}${lang}\n${s}\n${f}`; };
const details = (title: string, body: string) => `<details>\n<summary>${title}</summary>\n\n${body}\n\n</details>`;
const table = (rows: string[][]) => rows.map((r) => `| ${r.join(" | ")} |`).join("\n");

/** What a config value may look like in a report: a type, unless the user opted in; a secret never. */
export function shownValue(key: string, value: unknown, include: boolean): string {
  if (isSecretName(key)) return "<redacted>";
  if (!include) return typeof value === "string" ? "<string>" : typeof value === "boolean" ? "<boolean>" : typeof value === "number" ? "<number>" : Array.isArray(value) ? `<list of ${value.length}>` : "<set>";
  return JSON.stringify(value);
}

export function buildBundle(i: ReportInput, o: BundleOptions = {}): Bundle {
  const excluded = ["environment variable values", "secrets and tokens (also redacted by pattern)", "email addresses and home-directory names", ...(o.includeConfigValues ? [] : ["config values (only keys and which layer set them)"]), ...(i.kage?.doc !== undefined ? [] : ["document text, comments and briefs"])];
  const v = i.versions;
  const parts: string[] = [
    "> Nothing was sent anywhere. This was assembled locally. **Read it before you share it.**",
    "## What were you doing?\n\n_(describe the command you ran)_\n\n## What happened?\n\n_(what you saw)_\n\n## What did you expect?\n\n_(what should have happened)_",
    details("Versions and environment", table([["", ""], ["---", "---"], ["kages", v.kages], ["node", v.node], ["os", `${v.platform} ${v.arch}`], ["package manager", v.packageManager], ["installed as", v.install], ...(i.install ? [["install manifest", `v${i.install.version}, ${i.install.scope}, providers: ${i.install.providers.join(", ") || "none"}`]] : [["install manifest", "none"]])]) + "\n\nEnvironment (set or not; values are never included):\n\n" + table([["variable", "set"], ["---", "---"], ...Object.entries(i.env).sort(([a], [b]) => a.localeCompare(b)).map(([k, s]) => [`\`${k}\``, s ? "yes" : "no"])])),
    details("Harness and hooks", `Detected: ${i.harness.detected.join(", ") || "none"}\n\nHooks installed: ${i.harness.hooksInstalled.join(", ") || "none"}`),
    details("Config (which layer set each key)", (i.config.entries.length ? table([["key", "set by", "value"], ["---", "---", "---"], ...i.config.entries.map((e) => [`\`${e.key}\``, e.layer, shownValue(e.key, e.value, !!o.includeConfigValues)])]) : "No keys set beyond the defaults.") + (i.config.problems.length ? `\n\nProblems:\n\n${i.config.problems.map((p) => `- ${p}`).join("\n")}` : "")),
  ];
  if (i.doctor) parts.push(details(`Doctor (${i.doctor.findings.length} finding${i.doctor.findings.length === 1 ? "" : "s"})`, i.doctor.findings.length ? i.doctor.findings.map((f) => `- \`${f.id}\` (${f.severity}, ${f.area}): ${f.message}`).join("\n") : `No drift found (${i.doctor.ran.join(", ")}).`));
  if (i.adviceLog) parts.push(details("Advice log (counts only)", `${i.adviceLog.calls} calls, ${i.adviceLog.writes} writes, ${i.adviceLog.writesWithRegressions} with new findings.`));
  const k = i.kage;
  if (k) {
    const issue = (x: { code: string; at: string }) => `- \`${x.code}\` at \`${x.at}\``;
    const body = [
      `System \`${k.system}\`, ${k.versions} version${k.versions === 1 ? "" : "s"}, ${k.blocks} blocks.`,
      `Block types: ${Object.entries(k.histogram).sort(([a], [b]) => a.localeCompare(b)).map(([t, n]) => `${t}×${n}`).join(", ") || "none"}`,
      `**Validation:** ${k.validation.errors.length} error(s), ${k.validation.warnings.length} warning(s)`,
      ...k.validation.errors.map(issue), ...k.validation.warnings.map(issue),
      `**Lint:** ${k.lint.length} finding(s)`,
      ...k.lint.map((l) => `- \`${l.rule}\` (${l.severity}) at \`${l.at}\``),
    ].join("\n");
    parts.push(details(`Kage \`${k.name}\``, body));
    if (k.doc !== undefined) {
      const limit = o.docLimit ?? DOC_LIMIT, cut = k.doc.length > limit;
      parts.push(details("Document (included at your request)", fence(cut ? k.doc.slice(0, limit) : k.doc, "json") + (cut ? `\n\n_Truncated to ${limit} characters of ${k.doc.length}._` : "")));
    }
  }
  parts.push(`---\n_Excluded from this report: ${excluded.join("; ")}._`);
  // The second pass: the whole bundle, however it was assembled.
  const r = redactDetailed(parts.join("\n\n"), { home: o.home, extra: o.extraSecrets });
  return { markdown: r.text + "\n", excluded, redactions: r.counts };
}

/** A pre-filled new-issue URL, length-capped so it survives browsers and proxies; the full bundle stays local. */
export function issueUrl(repoUrl: string, title: string, summary: string, max = 7000): string {
  const base = `${repoUrl.replace(/\/$/, "")}/issues/new`;
  const make = (body: string) => `${base}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
  const note = "\n\n_(Paste the full report that `kages report` wrote locally below this line.)_";
  let body = summary + note;
  while (make(body).length > max && body.length > 40) body = body.slice(0, Math.floor(body.length * 0.8)) + "…" + note;
  return make(body);
}
