// The CLI adapter: argv in, JSON out, exit code = ok?0:1. Like every adapter it
// is a pure translation of the operation table — it parses `kages <op> --k v`
// into a dispatch call and prints the result. No logic here. The three commands
// the spec names (validate/publish/export) are just operations; the generic
// form reaches all of them. See oracle/agent-access.feature.

import { formatDetails, dispatch, type OpContext } from "./operations.ts";

/** Parse `--key value` / `--flag` / `--key @file.json` into a params object.
 *  A value that parses as JSON is used as JSON (so `--ops '[...]'` works);
 *  otherwise it stays a string. */
export function parseArgs(argv: string[]): { op: string; params: Record<string, unknown> } {
  const [op, ...rest] = argv;
  const params: Record<string, unknown> = {};
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--")) continue;
    const key = rest[i].slice(2);
    const next = rest[i + 1];
    if (next === undefined || next.startsWith("--")) { params[key] = true; continue; }
    params[key] = tryJson(next);
    i++;
  }
  return { op, params };
}

function tryJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export interface CliResult { code: number; out: string; }

/** Run one CLI invocation against a context and return the printable result. */
export function runCli(ctx: OpContext, argv: string[]): CliResult {
  const { op, params } = parseArgs(argv);
  if (!op || op === "help") return { code: 0, out: "usage: kages <operation> [--key value]" };
  const r = dispatch(ctx, op, params);
  return r.ok
    ? { code: 0, out: JSON.stringify(r.data, null, 2) }
    : { code: 1, out: `error ${r.error.code}: ${r.error.msg}${formatDetails((r.error as { details?: unknown }).details)}` };
}
