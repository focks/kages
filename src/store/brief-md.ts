// Markdown form of the brief, for review in git. The store is the source of
// truth; this file is an export a pull request can diff. Round trip is lossless
// for any brief that passes validateBrief (strings trimmed, list items single
// line), which the tests check against generated briefs.
import { BRIEF_FIELDS, validateBrief, type Evidence, type WorkspaceBrief, type BriefCheck } from "./brief.ts";

const MARKER = "<!-- kages:brief-schema 1 -->";
const HEADINGS: Record<string, string> = {
  users: "Users", purpose: "Purpose", positioning: "Positioning", operatingContext: "Operating context",
  constraints: "Constraints", voice: "Voice", brandCommitments: "Brand commitments", evidence: "Evidence",
  absent: "Absent", principles: "Principles", openDecisions: "Open decisions", inferred: "Inferred",
};
const BY_HEADING = new Map(Object.entries(HEADINGS).map(([k, h]) => [h.toLowerCase(), k]));
const TEXT = new Set(["users", "purpose", "positioning", "operatingContext", "voice", "brandCommitments"]);

// A body line starting with `#` would read as a heading, so it gets one extra
// backslash; the parser strips exactly one. Applied to any run of leading
// backslashes before `#` so the escape itself round-trips.
const escLine = (l: string) => (/^\\*#/.test(l) ? "\\" + l : l);
const unescLine = (l: string) => (/^\\+#/.test(l) ? l.slice(1) : l);
const escPipe = (s: string) => s.replace(/\\/g, "\\\\").replace(/\|/g, "\\|");
const splitPipes = (s: string): string[] => {
  const parts: string[] = []; let cur = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "\\" && i + 1 < s.length) { cur += s[i + 1]; i++; }
    else if (s[i] === "|") { parts.push(cur); cur = ""; }
    else cur += s[i];
  }
  parts.push(cur);
  return parts.map((p) => p.trim());
};

export function renderBriefMd(brief: WorkspaceBrief): string {
  const out = [MARKER, "# Workspace brief", ""];
  for (const key of ["users", "purpose", "positioning", "operatingContext", "constraints", "voice", "brandCommitments", "evidence", "absent", "principles", "openDecisions", "inferred"]) {
    const v = (brief as unknown as Record<string, unknown>)[key];
    if (v === undefined) continue;
    out.push(`## ${HEADINGS[key]}`, "");
    if (TEXT.has(key)) out.push(...(v as string).split("\n").map((l) => escLine(l.replace(/\r$/, ""))));
    else if (key === "evidence") for (const e of v as Evidence[]) out.push(`- ${e.kind} | ${escPipe(e.ref)}${e.note ? ` | ${escPipe(e.note)}` : ""}`);
    else for (const s of v as string[]) out.push(`- ${s}`);
    out.push("");
  }
  return out.join("\n");
}

export type ParseResult = (Extract<BriefCheck, { ok: true }> | Extract<BriefCheck, { ok: false }>) & { notes: string[] };

/** Parse a rendered brief (or a hand-edited one) back into a validated brief.
 *  Unknown sections are reported in `notes` and dropped, never stored. */
export function parseBriefMd(md: string): ParseResult {
  const notes: string[] = [];
  const sections = new Map<string, string[]>();
  let current: string | null = null;
  for (const raw of md.replace(/\r\n/g, "\n").split("\n")) {
    const m = /^##\s+(.+?)\s*$/.exec(raw);
    if (m) {
      const key = BY_HEADING.get(m[1].toLowerCase());
      if (key) { current = key; sections.set(key, []); } else { current = null; notes.push(`ignored unknown section "${m[1]}"`); }
      continue;
    }
    if (current) sections.get(current)!.push(raw);
  }
  const obj: Record<string, unknown> = { schema: 1 };
  for (const [key, lines] of sections) {
    const body = lines.join("\n").replace(/^\n+|\n+$/g, "");
    if (TEXT.has(key)) obj[key] = body.split("\n").map(unescLine).join("\n");
    else {
      const items = lines.filter((l) => /^- /.test(l)).map((l) => l.slice(2));
      if (key === "evidence") obj[key] = items.map((it) => { const [kind, ref, note] = splitPipes(it); return { kind, ref, ...(note ? { note } : {}) }; });
      else obj[key] = items;
    }
  }
  const check = validateBrief(obj);
  return { ...check, notes };
}

export { BRIEF_FIELDS };
