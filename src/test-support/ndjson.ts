// Strict NDJSON reader: a torn or partial line is a bug in the writer (an
// interleaved append, a crash mid-write), so it must fail loudly rather than
// be skipped.
import { readFileSync } from "node:fs";

export function readNdjson<T = unknown>(path: string): T[] {
  const text = readFileSync(path, "utf8");
  if (text === "") return [];
  if (!text.endsWith("\n")) throw new Error(`${path}: last line is not newline-terminated (torn write?)`);
  return text.slice(0, -1).split("\n").map((line, i) => {
    try { return JSON.parse(line) as T; } catch { throw new Error(`${path}:${i + 1}: not valid JSON: ${line.slice(0, 80)}`); }
  });
}
