// `kages report`: a diagnostic bundle you can read, then file. Nothing is ever sent: the
// default output is markdown on stdout; `--open` only opens a pre-filled new-issue URL after a
// y/N prompt, and the full bundle stays local for the person to paste. Every effect (disk,
// clock, browser, prompt) is injected so the sentinel tests can run it with the network
// stubbed to throw.
import { chmodSync, existsSync, writeFileSync } from "node:fs";
import type { LoadedConfig } from "../config/load.ts";
import { lintDetailed } from "../engine/advice.ts";
import { validate } from "../engine/validate.ts";
import type { KageDoc } from "../engine/types.ts";
import type { DoctorReport } from "../doctor/types.ts";
import type { Manifest } from "../install/run.ts";
import { buildBundle, issueUrl, DOC_LIMIT, type ReportInput } from "../report/bundle.ts";
import { out, printJson } from "./format.ts";

export const REPO_URL = "https://github.com/focks/kages";
/** Env names whose presence is reported (never their values). */
const ENV_PREFIXES = [/^KAGES_/, /^SUPABASE_/, /^NEXT_PUBLIC_SUPABASE_/];
const ENV_EXACT = ["DATABASE_URL", "POSTGRES_URL"];

export interface ReportDeps {
  versions: ReportInput["versions"];
  env: Record<string, string | undefined>;
  home: string;
  config: LoadedConfig;
  doctor: DoctorReport | null;
  manifest: Manifest | null;
  detectedHarnesses: string[];
  /** The Kage to summarise, with its stored version count. */
  kage?: { name: string; doc: KageDoc; versions: number };
  adviceLog: ReportInput["adviceLog"];
  isTTY: boolean;
  confirm: (question: string) => Promise<boolean>;
  open: (url: string) => void;
}

export function collect(d: ReportDeps, o: { includeDoc?: boolean; docText?: string }): ReportInput {
  const names = new Set([...ENV_EXACT, ...Object.keys(d.env).filter((k) => ENV_PREFIXES.some((p) => p.test(k)))]);
  const k = d.kage;
  let kage: ReportInput["kage"];
  if (k) {
    const v = validate(k.doc), lint = lintDetailed(k.doc, { system: v.system });
    const histogram: Record<string, number> = {};
    for (const b of Object.values(k.doc.blocks)) histogram[b.type] = (histogram[b.type] ?? 0) + 1;
    kage = {
      name: k.name, system: v.system, versions: k.versions, blocks: Object.keys(k.doc.blocks).length, histogram,
      validation: { errors: v.errors.map((e) => ({ code: e.code, at: e.at })), warnings: v.warnings.map((e) => ({ code: e.code, at: e.at })) },
      lint: lint.findings.map((f) => ({ rule: f.rule ?? f.code, severity: f.severity ?? "P3", at: f.at })),
      ...(o.includeDoc ? { doc: o.docText } : {}),
    };
  }
  return {
    versions: d.versions,
    install: d.manifest ? { version: d.manifest.version, scope: d.manifest.scope, providers: d.manifest.providers, hooks: d.manifest.hooks } : null,
    env: Object.fromEntries([...names].map((n) => [n, !!d.env[n]])),
    config: { entries: Object.entries(d.config.sources).filter(([, layer]) => layer !== "default").map(([key, layer]) => ({ key, layer, value: key.split(".").reduce<unknown>((a, p) => (a as Record<string, unknown> | undefined)?.[p], d.config.value) })), problems: d.config.problems.map((p) => p.message) },
    doctor: d.doctor ? { ran: d.doctor.ran, findings: d.doctor.findings.map((f) => ({ id: f.id, severity: f.severity, area: f.area, message: f.message })) } : null,
    harness: { detected: d.detectedHarnesses, hooksInstalled: d.manifest?.hooks ?? [] },
    ...(kage ? { kage } : {}),
    adviceLog: d.adviceLog,
  };
}

export async function reportCmd(flags: Record<string, unknown>, d: ReportDeps): Promise<number> {
  const includeDoc = flags["include-doc"] === true;
  let docText: string | undefined;
  if (includeDoc) {
    if (!d.kage) { process.stderr.write("--include-doc needs --kage <name>\n"); return 1; }
    docText = JSON.stringify(d.kage.doc, null, 2);
    process.stderr.write(`--include-doc adds the full text of '${d.kage.name}' (${docText.length} characters${docText.length > DOC_LIMIT ? `; truncated to ${DOC_LIMIT}` : ""}) to the report.\nAnything private in the document will be in it.\n`);
    if (!(await d.confirm("Include the document?"))) { process.stderr.write("Not included. Run again without --include-doc.\n"); return 1; }
  }
  const input = collect(d, { includeDoc, docText });
  const extra = [d.env.DATABASE_URL, d.env.POSTGRES_URL, d.env.KAGES_TOKEN, d.env.SUPABASE_SERVICE_ROLE_KEY].filter((x): x is string => !!x);
  const bundle = buildBundle(input, { includeConfigValues: flags["include-config-values"] === true, home: d.home, extraSecrets: extra });

  if (flags.out) {
    const file = String(flags.out);
    if (existsSync(file) && flags.force !== true) { process.stderr.write(`${file} exists; pass --force to overwrite it.\n`); return 1; }
    writeFileSync(file, bundle.markdown, { mode: 0o600 });
    chmodSync(file, 0o600);
    process.stderr.write(`Wrote ${file} (mode 600). Nothing was sent. Read it before you share it.\n`);
  } else if (flags.json === true) printJson({ markdown: bundle.markdown, excluded: bundle.excluded, redactions: bundle.redactions });
  else out(bundle.markdown.trimEnd());

  if (flags.verify === true) {
    const entries = Object.entries(bundle.redactions);
    process.stderr.write(entries.length ? `Redacted: ${entries.map(([c, n]) => `${c} ×${n}`).join(", ")}\n` : "Redacted: nothing matched a secret pattern.\n");
    process.stderr.write(`Excluded: ${bundle.excluded.join("; ")}.\n`);
  }

  if (flags.open === true) {
    if (!d.isTTY) { process.stderr.write("--open needs an interactive terminal; the report above is complete, paste it into a new issue yourself.\n"); return 1; }
    const url = issueUrl(REPO_URL, "[report] ", `Kages ${d.versions.kages}, Node ${d.versions.node}, ${d.versions.platform} ${d.versions.arch}.\n\n(describe what you were doing, what happened, and what you expected)`);
    if (await d.confirm(`Open a new-issue page on ${REPO_URL}? Only the title and a short environment line are pre-filled; paste the report yourself.`)) { d.open(url); process.stderr.write("Opened. Paste the report into the issue body.\n"); }
  }
  return 0;
}
