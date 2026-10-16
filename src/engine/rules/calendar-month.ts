import type { Finding, Rule } from "./types.ts";

export const calendarMonth: Rule = {
  id: "calendar-month", category: "content", severity: "P1", tier: "immediate",
  summary: "A calendar whose month is not YYYY-MM.",
  rationale: "The block shows an error instead of a month.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      const p = (b.props ?? {}) as Record<string, unknown>;
      if (b.type === "calendar" && typeof p.month === "string" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(p.month) && !(b.bind && "month" in b.bind))
        out.push({ at: `/blocks/${id}/props/month`, msg: `\`${id}\` has month "${p.month}"; it must look like 2026-03, otherwise the calendar shows an error.`, fix: 'Use "YYYY-MM".' });
    }
    return out;
  },
};
