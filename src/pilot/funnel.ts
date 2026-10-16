// Pilot measurements derived from the workspace itself, so no telemetry is needed and nothing
// leaves the machine unless the person chooses to send the numbers. The output is counts and
// whole days only: no titles, text, names or ids. `pilotStats` describes one participant's
// workspace; `summarize` applies the pilot's decision thresholds to many participants.
// The funnel: set up -> useful guide created -> shared -> feedback came back -> revised -> returned.
import type { Store } from "../store/store.ts";

export interface PilotStats {
  v: 1;
  guides: number;
  /** Whole days between the first and second guide created; null with fewer than two. */
  daysToSecondGuide: number | null;
  shared: number;
  withFeedback: number;
  guestComments: number;
  revisedAfterShare: number;
  /** Distinct calendar days with any new version: a proxy for coming back. */
  activeDays: number;
  /** Guides whose facts a person marked verified. */
  verified: number;
}

const DAY = 86_400_000;
const day = (iso: string) => iso.slice(0, 10);

export function pilotStats(store: Store): PilotStats {
  const heads = store.list();
  const created: number[] = [], days = new Set<string>();
  let shared = 0, withFeedback = 0, guest = 0, revised = 0, verified = 0;
  for (const h of heads) {
    const vs = store.versions(h.name);
    created.push(Date.parse(vs[0].createdAt));
    for (const v of vs) days.add(day(v.createdAt));
    const firstShare = vs.findIndex((v) => v.state === "published" && (v.visibility === "link" || v.visibility === "public"));
    if (firstShare >= 0) { shared++; if (vs.length > firstShare + 1) revised++; }
    const g = store.comments.all(h.name).filter((c) => c.author.startsWith("guest:")).length;
    guest += g; if (g) withFeedback++;
    const verify = h.doc.blocks.verify;
    if (verify && verify.type === "text") verified++;
  }
  created.sort((a, b) => a - b);
  return { v: 1, guides: heads.length, daysToSecondGuide: created.length >= 2 ? Math.floor((created[1] - created[0]) / DAY) : null, shared, withFeedback, guestComments: guest, revisedAfterShare: revised, activeDays: days.size, verified };
}

export interface Threshold { id: string; label: string; need: number; got: number; met: boolean }
export interface Summary { participants: number; thresholds: Threshold[]; allMet: boolean }

/** The decision thresholds proposed in the product assessment, applied to participants' stats. They are
 *  decision aids set before the pilot, not industry benchmarks; interviews and a paid-pilot ask are separate and human. */
export function summarize(all: PilotStats[]): Summary {
  const n = all.length;
  const count = (f: (s: PilotStats) => boolean) => all.filter(f).length;
  const scale = (x: number) => Math.ceil((x * n) / 10); // the thresholds are written for ten people
  const row = (id: string, label: string, need: number, got: number): Threshold => ({ id, label, need, got, met: n > 0 && got >= need });
  const thresholds = [
    row("first-guide", "created a guide", scale(7), count((s) => s.guides >= 1)),
    row("second-guide", "created another guide within a week", scale(5), count((s) => s.daysToSecondGuide !== null && s.daysToSecondGuide <= 7)),
    row("shared", "shared a guide by link", scale(3), count((s) => s.shared >= 1)),
    row("feedback", "got feedback from a recipient", Math.max(1, scale(2)), count((s) => s.withFeedback >= 1)),
    row("returned", "was active on at least two different days", scale(5), count((s) => s.activeDays >= 2)),
  ];
  return { participants: n, thresholds, allMet: n > 0 && thresholds.every((t) => t.met) };
}

export function parseStats(text: string): PilotStats {
  const o = JSON.parse(text) as Partial<PilotStats>;
  if (o.v !== 1 || typeof o.guides !== "number") throw new Error("not a kages pilot stats file (run `kages pilot stats --json`)");
  return o as PilotStats;
}
