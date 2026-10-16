// Small text helpers shared by hints and lint messages.

/** Edit distance, bounded: past `max` the answer no longer matters. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = row;
  }
  return prev[b.length];
}

export const list = (xs: readonly string[]) => (xs.length ? xs.map((x) => "`" + x + "`").join(", ") : "none");

export { distance };

/** The closest candidate, if it is close enough to be a plausible typo rather
 *  than a coincidence. Case-insensitive; a shared prefix/suffix also counts. */
export function nearest(word: string, candidates: readonly string[]): string | undefined {
  const w = word.toLowerCase();
  let best: string | undefined, bestD = Infinity;
  for (const c of candidates) {
    const lc = c.toLowerCase();
    const d = lc === w ? 0 : distance(w, lc, 4) - (lc.includes(w) || w.includes(lc) ? 1 : 0);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best !== undefined && bestD <= Math.max(2, Math.floor(w.length / 3)) ? best : undefined;
}
