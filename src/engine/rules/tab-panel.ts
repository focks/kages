import type { Finding, Rule } from "./types.ts";

// Both tab-panel rules share one scan; each is its own registered rule so it can
// be waived and counted separately.
function scan(blocks: Record<string, import("../types.ts").Block>): { extra: Finding[]; empty: Finding[] } {
  const extra: Finding[] = [], empty: Finding[] = [];
  for (const [id, b] of Object.entries(blocks)) {
    if (b.type !== "tab-panel") continue;
    const p = (b.props ?? {}) as Record<string, unknown>, base = "/blocks/" + id;
    const n = Array.isArray(p.tabs) ? p.tabs.length : 0;
    const used = Object.keys(b.slots ?? {}).filter((s) => /^panel\d$/.test(s) && (b.slots![s] ?? []).length);
    for (const s of used) if (Number(s.slice(5)) > n) extra.push({ at: `${base}/slots/${s}`, msg: `\`${s}\` has content but there are only ${n} tab(s); it will never show.`, fix: "Add a tab for it or move the blocks." });
    for (let i = 1; i <= Math.min(n, 6); i++) if (!used.includes("panel" + i)) empty.push({ at: `${base}/slots/panel${i}`, msg: `Tab ${i} has no blocks in \`panel${i}\`; it will open to an empty panel.`, fix: `Put blocks in slots.panel${i}.` });
  }
  return { extra, empty };
}

export const tabPanelExtraSlot: Rule = {
  id: "tab-panel-extra-slot", category: "structure", severity: "P2", tier: "immediate",
  summary: "A tab-panel slot with content but no matching tab.",
  rationale: "Blocks in a panel that no tab selects are invisible to readers.",
  check: ({ blocks }) => scan(blocks).extra,
};

export const tabPanelEmpty: Rule = {
  id: "tab-panel-empty", category: "structure", severity: "P2", tier: "immediate",
  summary: "A tab that opens to an empty panel.",
  rationale: "The reader clicks a tab and sees nothing, which reads as a bug.",
  check: ({ blocks }) => scan(blocks).empty,
};
