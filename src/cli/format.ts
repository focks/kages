// Output helpers for the CLI: a plain-text table, key/value blocks, and a JSON
// escape hatch. Human-readable by default; `--json` everywhere returns the raw
// operation result for scripts and agents. No colour (pipes and CI stay clean).

export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value, null, 2) + "\n");
}

export interface Column<T> {
  header: string;
  get: (row: T) => string;
  align?: "left" | "right";
}

/** A left/right-aligned text table sized to its content. */
export function table<T>(rows: T[], columns: Column<T>[]): string {
  if (rows.length === 0) return "(none)";
  const cells = rows.map((r) => columns.map((c) => c.get(r) ?? ""));
  const widths = columns.map((c, i) => Math.max(c.header.length, ...cells.map((row) => row[i].length)));
  const pad = (s: string, w: number, align?: "left" | "right") =>
    align === "right" ? s.padStart(w) : s.padEnd(w);
  const line = (vals: string[]) => vals.map((v, i) => pad(v, widths[i], columns[i].align)).join("  ").trimEnd();
  const head = line(columns.map((c) => c.header.toUpperCase()));
  const body = cells.map(line);
  return [head, ...body].join("\n");
}

/** A `key  value` block for a single record's fields. */
export function kv(pairs: Array<[string, string]>): string {
  const w = Math.max(...pairs.map(([k]) => k.length));
  return pairs.map(([k, v]) => k.padEnd(w) + "  " + v).join("\n");
}

export function out(s: string): void {
  process.stdout.write(s + "\n");
}

export function err(s: string): void {
  process.stderr.write(s + "\n");
}
