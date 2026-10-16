import { briefIssues } from "../brief.ts";
import type { Rule } from "./types.ts";

// Reported here and not by the oracle validator, whose output is pinned to the
// reference byte-for-byte; the validator ignores unknown top-level keys, so a bad
// brief would otherwise pass in silence.
export const briefInvalid: Rule = {
  id: "brief-invalid", category: "system", severity: "P2", tier: "deep",
  summary: "The Kage's brief is malformed.",
  rationale: "Mode-aware rules and reviews read `brief`. A bad mode or an unknown field is ignored, so the Kage is judged as if it had no brief at all.",
  check({ doc }) {
    return briefIssues(doc.brief).map((msg) => ({ at: "/brief", msg, fix: "Use {mode: read|operate|persuade|experience, audience?, job?, primaryAction?, evidence?, useScene?, notes?}." }));
  },
};
