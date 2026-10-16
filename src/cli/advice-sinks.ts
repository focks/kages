// Where advice-log lines go. Off by default. A file sink appends one line per call
// (under 4 KB, so concurrent processes cannot interleave) and rotates at 5 MB; a
// stdout sink serves containers. The hosted server has no durable disk, so a file
// sink there is refused with a clear message rather than silently losing lines.
import { appendFileSync, existsSync, renameSync, rmSync, statSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import type { AdviceLogEntry, AdviceSink } from "../engine/advice-log.ts";

export const MAX_LOG_BYTES = 5 * 1024 * 1024;
export const KEEP_ROTATIONS = 3;

export const NullSink: AdviceSink = { write() { /* disabled */ } };

export const StdoutSink: AdviceSink = { write(e) { process.stdout.write(JSON.stringify(e) + "\n"); } };

export function rotate(path: string, maxBytes = MAX_LOG_BYTES): void {
  let size = 0;
  try { size = statSync(path).size; } catch { return; }
  if (size < maxBytes) return;
  rmSync(`${path}.${KEEP_ROTATIONS}`, { force: true });
  for (let i = KEEP_ROTATIONS - 1; i >= 1; i--) if (existsSync(`${path}.${i}`)) renameSync(`${path}.${i}`, `${path}.${i + 1}`);
  renameSync(path, `${path}.1`);
}

export class FileSink implements AdviceSink {
  path: string; maxBytes: number;
  constructor(path: string, maxBytes = MAX_LOG_BYTES) { this.path = path; this.maxBytes = maxBytes; }
  write(entry: AdviceLogEntry): void {
    try {
      mkdirSync(dirname(this.path), { recursive: true });
      rotate(this.path, this.maxBytes);
      appendFileSync(this.path, JSON.stringify(entry) + "\n");
    } catch { /* an audit log must never break a write */ }
  }
}

export interface SinkChoice { sink: AdviceSink; problem?: string; path?: string }

/** `setting` is config `advice.auditLog` (true, a path, or "stdout"); `env` is KAGES_ADVICE_LOG. */
export function chooseSink(opts: { setting?: unknown; env?: string; workspaceDir?: string; hosted?: boolean }): SinkChoice {
  const raw = opts.env !== undefined && opts.env !== "" ? opts.env : opts.setting;
  if (raw === undefined || raw === false || raw === "" || raw === "0" || raw === "false") return { sink: NullSink };
  if (raw === "stdout") return { sink: StdoutSink };
  if (opts.hosted) return { sink: NullSink, problem: "KAGES_ADVICE_LOG must be \"stdout\" on a hosted server: it has no durable disk, so a file log would be lost. The advice log is off." };
  const path = raw === true || raw === "1" || raw === "true" ? join(opts.workspaceDir ?? ".kages", "advice.log.ndjson") : String(raw);
  return { sink: new FileSink(path), path };
}
