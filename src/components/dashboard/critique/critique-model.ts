// What the Library shows about a Kage's critique, as pure functions: the card chip,
// the banners, the sorted backlog and the heuristic names. No React and relative
// imports, so the wording and thresholds are unit-tested. The scores are never
// computed here: they arrive from the store.
import { HEURISTICS } from "../../../packs/rubric.ts";

export interface CritiqueSummary { score: number; max: number; stale: boolean; open: { P0: number; P1: number } }
export interface BacklogItem { sev: "P0" | "P1" | "P2" | "P3"; title: string; why?: string; fix: string; command?: string; block?: string; status: "open" | "fixed" | "wontfix" }
export interface CritiqueView {
  id: string; version: number; method: "dual-agent" | "degraded" | "single"; degradedReason?: string; total: number; max: number;
  scores: Record<string, number | null>; naReasons?: Record<string, string>; priorities: BacklogItem[]; body: string;
  state: "open" | "closed"; createdAt: string; author: string; stale: boolean;
}

export type ChipTone = "good" | "attention" | "muted";

/** The small score chip on a card. A stale critique still shows, but dimmed and labelled, never as current. */
export function chipFor(c: CritiqueSummary | null | undefined): { text: string; title: string; tone: ChipTone } | null {
  if (!c) return null;
  const open = c.open.P0 + c.open.P1;
  const tone: ChipTone = c.stale ? "muted" : open > 0 ? "attention" : "good";
  const title = `${c.score} of ${c.max} on the last critique${c.stale ? ", written before the latest changes" : ""}${open ? `; ${open} open P0/P1` : ""}`;
  return { text: `${c.score}/${c.max}`, title, tone };
}

export const needsAttention = (c: CritiqueSummary | null | undefined): boolean => !!c && !c.stale && c.open.P0 + c.open.P1 > 0;

const SEV_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;
/** Open items first, then by severity, keeping the original index (the store addresses items by it). */
export function sortedBacklog(items: readonly BacklogItem[]): { item: BacklogItem; index: number }[] {
  return items.map((item, index) => ({ item, index })).sort((a, b) => (a.item.status === "open" ? 0 : 1) - (b.item.status === "open" ? 0 : 1) || SEV_ORDER[a.item.sev] - SEV_ORDER[b.item.sev] || a.index - b.index);
}

export function banners(c: CritiqueView): { tone: "warn" | "info"; text: string }[] {
  const out: { tone: "warn" | "info"; text: string }[] = [];
  if (c.stale) out.push({ tone: "warn", text: "The Kage has changed since this critique. Treat it as history, or run a new one." });
  if (c.method === "degraded") out.push({ tone: "warn", text: `Single-context review (${c.degradedReason ?? "no reason given"}). The design review and the evidence were not isolated, so the scores may lean on the automated findings.` });
  if (c.method === "single") out.push({ tone: "info", text: "Reviewed in one pass." });
  if (c.state === "closed") out.push({ tone: "info", text: "Closed: its backlog was cleared." });
  return out;
}

export function scoreRows(c: Pick<CritiqueView, "scores" | "naReasons">): { id: number; name: string; score: number | null; reason?: string }[] {
  return HEURISTICS.filter((h) => String(h.id) in c.scores).map((h) => ({ id: h.id, name: h.name, score: c.scores[String(h.id)], ...(c.scores[String(h.id)] === null ? { reason: c.naReasons?.[String(h.id)] } : {}) }));
}

export const SEV_LABEL = { P0: "Blocks the task", P1: "Major", P2: "Minor", P3: "Polish" } as const;
