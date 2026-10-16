// Claims: time-boxed leases on a block subtree for work too long for optimistic
// merge. The lease is what stops two agents fighting over the same blocks, and
// the TTL is what stops a crashed agent holding a Kage hostage forever — an
// expired claim is simply ignored, no manual release needed. Patterns like
// "kpi*" let an agent claim a family of ids at once. See
// oracle/collaboration.feature.

export interface Claim {
  kage: string;
  patterns: string[];
  principal: string;
  expiresAt: number; // epoch ms
}

/** Glob-ish match: "kpi*" matches "kpi", "kpiOpen"; exact otherwise. Only "*"
 *  is special (any run of chars), which is all the spec's examples need. */
export function matchesPattern(pattern: string, id: string): boolean {
  if (pattern === id) return true;
  if (!pattern.includes("*")) return false;
  const re = new RegExp("^" + pattern.split("*").map(escapeRegExp).join(".*") + "$");
  return re.test(id);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class ClaimRegistry {
  private claims: Claim[] = [];

  /** Claim blocks on a Kage for ttl seconds. Fails if any requested block is
   *  already claimed (unexpired) by a different principal. `now` is injected so
   *  the registry stays deterministic and testable (no hidden clock). */
  claim(kage: string, patterns: string[], principal: string, ttlSeconds: number, now: number): { ok: boolean; heldBy?: string } {
    this.gc(now);
    const held = this.claims.find(
      (c) => c.kage === kage && c.principal !== principal && patterns.some((p) => c.patterns.some((cp) => overlap(p, cp))),
    );
    if (held) return { ok: false, heldBy: held.principal };
    this.claims.push({ kage, patterns, principal, expiresAt: now + ttlSeconds * 1000 });
    return { ok: true };
  }

  /** Who, if anyone, holds a claim covering this block right now. */
  claimant(kage: string, blockId: string, now: number): string | null {
    this.gc(now);
    const c = this.claims.find((cl) => cl.kage === kage && cl.patterns.some((p) => matchesPattern(p, blockId)));
    return c ? c.principal : null;
  }

  /** A write by `principal` is refused if the block is claimed by someone else. */
  canWrite(kage: string, blockId: string, principal: string, now: number): boolean {
    const who = this.claimant(kage, blockId, now);
    return who === null || who === principal;
  }

  release(kage: string, principal: string): void {
    this.claims = this.claims.filter((c) => !(c.kage === kage && c.principal === principal));
  }

  /** Drop every claim on a Kage regardless of claimant — used when the Kage is
   *  deleted, so a later Kage reusing the name can't inherit a stale lease. */
  releaseAll(kage: string): void {
    this.claims = this.claims.filter((c) => c.kage !== kage);
  }

  /** Persist absolute expiry times so reloads preserve leases without extending them. */
  dump(): Claim[] { return JSON.parse(JSON.stringify(this.claims)); }

  /** Old snapshots have no leases; expired leases are discarded on the next access. */
  load(claims: Claim[] = []): void { this.claims = JSON.parse(JSON.stringify(claims)); }

  private gc(now: number): void {
    this.claims = this.claims.filter((c) => c.expiresAt > now);
  }
}

/** Two patterns overlap if either matches the other's literal stem — a coarse
 *  but safe test: when unsure we treat them as overlapping and refuse the claim,
 *  which errs toward isolation (the correct direction for a lease). */
function overlap(a: string, b: string): boolean {
  return matchesPattern(a, b.replace(/\*/g, "")) || matchesPattern(b, a.replace(/\*/g, "")) || a === b;
}
