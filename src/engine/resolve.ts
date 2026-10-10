// Resolve a block `type` against a design system, honouring inheritance,
// major pins and cross-system pins. Ported from the oracle. See
// oracle/design-systems.feature.

import { systems, contracts } from "./data.ts";
import type { KageDoc, ResolveResult } from "./types.ts";

export function semverMatch(have: string, want?: string): boolean {
  if (!want) return true;
  const a = have.split(".");
  const b = String(want).split(".");
  for (let i = 0; i < b.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function systemOf(doc: Partial<KageDoc>, override?: string): string {
  if (override) return override;
  const s = String(doc.system || "core@1");
  return s.split("@")[0];
}

const TYPE_RE = /^(?:([a-z][a-z0-9-]*)\/)?([a-z][a-z0-9-]*)(?:@([0-9.]+))?$/;

export function resolve(systemId: string, type: string): ResolveResult {
  const sys = systems[systemId];
  if (!sys) return { error: "Unknown design system '" + systemId + "'" };
  const m = TYPE_RE.exec(type || "");
  if (!m) return { error: "Malformed type '" + type + "'" };

  let ref: string | undefined;
  if (m[1]) {
    const src = systems[m[1]];
    if (!src) return { error: "Unknown design system '" + m[1] + "' in '" + type + "'" };
    ref = src.components[m[2]];
  } else {
    ref = sys.components[m[2]];
  }
  if (!ref) return { error: "'" + m[2] + "' is not a component of " + (m[1] || systemId) };

  // Cross-system pin ("core/dropdown@1" inside a ledger Kage). When the named
  // system INHERITS this role, src.components[name] points at the parent's ref
  // (e.g. ledger has no own text-input, so it reads "core/text-input@..."). But
  // if the caller explicitly named a system that DOES own a direct
  // implementation, prefer that own one: the pin "core/dropdown@1" must land on
  // core's dropdown even though we're rendering ledger. We detect "inherited"
  // by the ref not starting with "<named>/<name>", and upgrade to the direct
  // contract when one exists. This is the mechanism behind "use a 40-option
  // core listbox inside Ledger, whose segmented control caps at 6".
  if (m[1] && ref.split("@")[0] !== m[1] + "/" + m[2]) {
    const direct = Object.keys(contracts).filter((k) => k.indexOf(m[1] + "/" + m[2] + "@") === 0)[0];
    if (direct) ref = direct;
  }

  const c = contracts[ref];
  if (!semverMatch(c.version, m[3])) return { error: type + " requested but " + c.ref + " is installed" };
  return { ref, contract: c };
}
