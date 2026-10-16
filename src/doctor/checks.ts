// The checks, one function per area. Each names its findings with a stable id so a
// workspace can ignore one (`doctor.ignore`), a test can pin it, and the docs can list it.
// None of them writes anything: fixes belong to `kages doctor --fix` (safe ones) or to the
// command a finding names.
import { join } from "node:path";
import { parseBriefMd } from "../store/brief-md.ts";
import { ALL_HARNESSES } from "../hooks/install.ts";
import { MANIFESTS, MARKER } from "../hooks/manifest.ts";
import { HARNESSES } from "../hooks/harnesses.ts";
import { systems } from "../engine/data.ts";
import { findDeprecated, REGISTRY } from "../engine/deprecations.ts";
import { skillMd } from "../packs/packs.ts";
import type { Check, DoctorFinding } from "./types.ts";

const KNOWN_TOP = new Set(["version", "advice", "lint", "hook", "screenshot", "install", "report", "doctor"]);
const DAY = 86_400_000;

const config: Check = (c) => {
  const out: DoctorFinding[] = [];
  for (const p of c.config.problems) {
    if (p.key === "session" || p.key === "anonKey") out.push({ id: "config-secret-in-tracked", severity: "route", area: "config", message: `${p.file} contains \`${p.key}\`, which is a credential. It is ignored, but anyone who can read the repository can read it.`, fix: { command: "move it to ~/.kages/config.json (kages auth login) and delete it from the file", safe: false } });
    else out.push({ id: "config-invalid-json", severity: "route", area: "config", message: p.message, evidence: p.file, fix: { command: "edit the file, or `kages config set` to rewrite a key", safe: false } });
  }
  const shared = c.fs.readText(join(c.dir, "config.json"));
  if (shared) { try { const unknown = Object.keys(JSON.parse(shared)).filter((k) => !KNOWN_TOP.has(k)); if (unknown.length) out.push({ id: "config-unknown-key", severity: "mention", area: "config", message: `${join(c.dir, "config.json")} has keys this version does not read: ${unknown.join(", ")}. They are preserved, and ignored.` }); } catch { /* reported above */ } }
  return out;
};

const brief: Check = (c) => {
  const out: DoctorFinding[] = [];
  const rec = c.store ? c.store.getBrief({ principal: c.author.principal } as never) : null;
  const record = rec && rec.ok ? rec.value.record : null;
  const md = c.fs.readText(join(c.dir, "brief.md"));
  if (md !== null && record) {
    const parsed = parseBriefMd(md);
    if (!parsed.ok || JSON.stringify(parsed.brief) !== JSON.stringify(record.brief))
      out.push({ id: "brief-store-mismatch", severity: "route", area: "brief", message: `${join(c.dir, "brief.md")} no longer matches the stored brief (revision ${record.revision}).`, fix: { command: "kages brief import --file .kages/brief.md   (file wins)   or   kages brief export -o .kages/brief.md   (store wins)", safe: false } });
  } else if (md !== null && c.store && !record) out.push({ id: "brief-store-mismatch", severity: "route", area: "brief", message: "brief.md exists but the store has no brief.", fix: { command: "kages brief import --file .kages/brief.md", safe: false } });
  if (record?.brief.inferred?.length && c.now - Date.parse(record.updatedAt) > 7 * DAY)
    out.push({ id: "brief-unconfirmed", severity: "mention", area: "brief", message: `These brief fields are still unconfirmed drafts: ${record.brief.inferred.join(", ")}.`, fix: { command: "kages brief show; edit them to confirm", safe: false } });
  return out;
};

const store: Check = (c) => {
  const out: DoctorFinding[] = [];
  const raw = c.fs.readText(join(c.dir, "store.json"));
  if (raw !== null) {
    try { const j = JSON.parse(raw) as Record<string, unknown>; if (!("briefs" in j) || !("critiques" in j)) out.push({ id: "store-legacy-snapshot", severity: "auto", area: "store", message: "The workspace store predates briefs or critiques. The next write adds them; nothing is lost." }); } catch { out.push({ id: "store-unreadable", severity: "route", area: "store", message: `${join(c.dir, "store.json")} is not valid JSON.`, fix: { command: "restore it from version control or a backup; Kages will not guess", safe: false } }); }
    const size = c.fs.size(join(c.dir, "store.json"));
    if (size !== null && size > 2 * 1024 * 1024) out.push({ id: "store-size", severity: "mention", area: "store", message: `store.json is ${(size / 1048576).toFixed(1)} MB. It is one document per workspace, so very large workspaces will slow every command.` });
  }
  if (c.store) {
    const o = c.store.orphans();
    if (o.comments + o.critiques > 0) out.push({ id: "store-orphans", severity: "route", area: "store", message: `${o.comments} comment(s) and ${o.critiques} critique(s) refer to Kages that no longer exist.`, fix: { command: "kages doctor --fix", safe: true } });
  }
  return out;
};

const hooks: Check = (c) => {
  const out: DoctorFinding[] = [];
  const declined = c.config.value.hook?.consent === "declined";
  for (const h of ALL_HARNESSES) {
    const target = MANIFESTS[h].project;
    if (!target) continue;
    const file = join(c.projectRoot, target.relPath), text = c.fs.readText(file);
    const present = text !== null && text.includes(MARKER);
    const dir = join(c.projectRoot, target.relPath.split("/")[0]);
    if (!present) { if (!declined && c.fs.exists(dir) && h !== "copilot") out.push({ id: "hooks-missing", severity: "route", area: "hooks", message: `${h} is configured in this project but the Kages edit hook is not installed, so edits to *.kage.json get no feedback.`, fix: { command: `kages setup hooks --harness ${h}`, safe: false } }); continue; }
    const m = /"?([^"\s]*kages-hook)"?/.exec(text!.replace(/\\"/g, '"'));
    const launcher = m ? (m[1].startsWith("./") ? join(c.projectRoot, m[1]) : m[1]) : null;
    if (launcher && !c.fs.exists(launcher)) out.push({ id: "hooks-stale", severity: "route", area: "hooks", message: `${file} points at ${launcher}, which no longer exists.`, fix: { command: `kages setup hooks --harness ${h}`, safe: false } });
    else if (launcher && !c.fs.isExecutable(launcher)) out.push({ id: "hooks-launcher-missing", severity: "route", area: "hooks", message: `${launcher} is not executable, so the harness cannot run the hook.`, fix: { command: `chmod +x ${launcher}   (or kages setup hooks --harness ${h})`, safe: false } });
  }
  for (const h of HARNESSES) if (c.now - Date.parse(h.lastVerified) > 180 * DAY) out.push({ id: "hooks-schema-old", severity: "mention", area: "hooks", message: `The ${h.id} hook format was last checked against its docs on ${h.lastVerified}. Re-verify it at ${h.docsUrl}.` });
  return out;
};

const gitignore: Check = (c) => {
  if (!c.git || !c.fs.exists(c.dir)) return [];
  const out: DoctorFinding[] = [];
  if (c.git.status === "missing" || c.git.status === "stale") out.push({ id: c.git.status === "missing" ? "gitignore-block-missing" : "gitignore-block-drift", severity: "route", area: "gitignore", message: `${c.git.file} ${c.git.status === "missing" ? "has no" : "has an out-of-date"} Kages block, so screenshots, caches, logs or the local config may be committed.`, fix: { command: "kages gitignore --write", safe: true } });
  if (c.git.status === "unbalanced") out.push({ id: "gitignore-block-drift", severity: "route", area: "gitignore", message: `${c.git.file} has an unbalanced kages-ignore marker.`, fix: { command: "fix the markers by hand", safe: false } });
  for (const f of c.git.tracked) out.push({ id: "tracked-runtime-file", severity: "route", area: "gitignore", message: `${f} is tracked by git but is local or generated.`, fix: { command: `git rm --cached -- ${f}`, safe: false } });
  return out;
};

const skills: Check = (c) => {
  const out: DoctorFinding[] = [];
  for (const id of Object.keys(systems)) {
    const text = c.fs.readText(join(c.home, ".claude", "skills", `kages-${id}`, "SKILL.md"));
    if (text !== null && text !== skillMd(id)) out.push({ id: "skills-stale", severity: "route", area: "skills", message: `The installed kages-${id} skill is from an older version, so agents there are missing recent guidance.`, fix: { command: "kages setup skills --harness claude", safe: false } });
  }
  return out;
};

const critiques: Check = (c) => {
  if (!c.store) return [];
  const out: DoctorFinding[] = [], me = { principal: c.author.principal } as never;
  for (const v of c.store.list().slice(0, 200)) {
    const r = c.store.latestCritique(v.name, me);
    if (!r.ok || !r.value) continue;
    if (r.value.stale) out.push({ id: "critique-stale", severity: "mention", area: "critique", message: `${v.name}: the last critique (${r.value.critique.total}/${r.value.critique.max}) predates the current version.`, fix: { command: `kages improve critique ${v.name}`, safe: false } });
    else if (r.value.open.P0 > 0) out.push({ id: "critique-open-p0", severity: "mention", area: "critique", message: `${v.name}: ${r.value.open.P0} open P0 issue(s) from the last critique.`, fix: { command: `kages improve polish ${v.name}`, safe: false } });
  }
  return out;
};

const deprecations: Check = (c) => {
  if (!c.store || !REGISTRY.length) return [];
  const out: DoctorFinding[] = [];
  for (const v of c.store.list().slice(0, 200)) { const n = findDeprecated(v.doc).length; if (n) out.push({ id: "deprecated-used", severity: "route", area: "deprecations", message: `${v.name} uses ${n} deprecated feature(s).`, fix: { command: `kages migrate ${v.name}`, safe: false } }); }
  return out;
};

const bundle: Check = (c) => {
  const js = c.fs.readText(join(c.projectRoot, "public/ds/bundle.js"));
  if (js === null) return [];
  const stale = Object.entries(systems).filter(([id, s]) => !js.includes(`version: "${s.version}", className: "kg-sys-${id}"`)).map(([id, s]) => `${id}@${s.version}`);
  return stale.length ? [{ id: "bundle-drift", severity: "route", area: "bundle", message: `public/ds/bundle.js does not carry ${stale.join(", ")}; the served design system is out of step with the registry.`, fix: { command: "npm run build:ds", safe: false } }] : [];
};

const env: Check = async (c) => {
  const out: DoctorFinding[] = [];
  if (Number(c.nodeVersion.split(".")[0]) < 18) out.push({ id: "env-node", severity: "route", area: "env", message: `Node ${c.nodeVersion} is older than 18, which Kages needs.`, fix: { command: "install Node 18 or newer", safe: false } });
  const url = c.env.DATABASE_URL;
  if (url && c.ping) { const problem = await c.ping(url); if (problem) out.push({ id: "env-db-unreachable", severity: "route", area: "env", message: `DATABASE_URL is set but the database did not answer (${problem}).`, fix: { command: "check the database is running and the URL is right (the URL is not shown here)", safe: false } }); }
  return out;
};

export const CHECKS: { area: string; run: Check }[] = [
  { area: "config", run: config }, { area: "brief", run: brief }, { area: "store", run: store }, { area: "hooks", run: hooks }, { area: "gitignore", run: gitignore },
  { area: "skills", run: skills }, { area: "critique", run: critiques }, { area: "deprecations", run: deprecations }, { area: "bundle", run: bundle }, { area: "env", run: env },
];
