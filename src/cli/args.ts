// A tiny argv parser: positionals plus `--flag value` / `--flag` / `-f`. A value
// that parses as JSON is kept as JSON (so `--ops '[...]'` and `--days 7` work);
// otherwise it stays a string. No dependency — the CLI is a thin translation of
// the operation table, and a parser is all the glue it needs.

export interface ParsedArgs {
  positionals: string[];
  flags: Record<string, unknown>;
}

const ALIASES: Record<string, string> = { C: "workspace", o: "out", s: "system", v: "version", h: "help" };
// Flags that are always boolean, so they never swallow the following positional
// (`kages --local create x` must keep `create x` as positionals, not local="create").
const BOOLEAN = new Set(["local", "json", "help", "dark", "no-sandbox", "create", "reopen"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const flags: Record<string, unknown> = {};
  // A repeated flag (e.g. --harness a --harness b) collects into an array;
  // single use stays a scalar, so existing callers are unaffected.
  const set = (key: string, value: unknown) => {
    if (!(key in flags)) { flags[key] = value; return; }
    const prev = flags[key];
    flags[key] = Array.isArray(prev) ? [...prev, value] : [prev, value];
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") { positionals.push(...argv.slice(i + 1)); break; }
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (BOOLEAN.has(key) || next === undefined || next.startsWith("-")) { set(key, true); }
      else { set(key, tryJson(next)); i++; }
    } else if (a.startsWith("-") && a.length > 1) {
      const key = ALIASES[a.slice(1)] ?? a.slice(1);
      const next = argv[i + 1];
      if (BOOLEAN.has(key) || next === undefined || next.startsWith("-")) { set(key, true); }
      else { set(key, tryJson(next)); i++; }
    } else {
      positionals.push(a);
    }
  }
  return { positionals, flags };
}

function tryJson(s: string): unknown {
  // Keep plain identifiers/paths as strings; only parse when it looks like JSON
  // (number, bool, null, array, object, quoted string). Avoids turning "core"
  // into something odd or a bare path into a number.
  if (/^(true|false|null|-?\d|[[{"])/.test(s)) {
    try { return JSON.parse(s); } catch { return s; }
  }
  return s;
}

export function flag<T = string>(flags: Record<string, unknown>, name: string, fallback?: T): T | undefined {
  const v = flags[name];
  return v === undefined ? fallback : (v as T);
}
