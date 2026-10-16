// The real filesystem behind HookFs, kept apart so run.ts stays pure and testable.
import { existsSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";

export const nodeFs = {
  readText: (p: string): string | null => { try { return readFileSync(p, "utf8"); } catch { return null; } },
  size: (p: string): number | null => { try { const s = statSync(p); return s.isFile() ? s.size : null; } catch { return null; } },
  realpath: (p: string): string | null => { try { return realpathSync(p); } catch { return null; } },
  writeText: (p: string, text: string): void => { writeFileSync(p, text); },
  ensureRuntimeDir: (p: string): void => { mkdirSync(p, { recursive: true }); const g = p + "/.gitignore"; if (!existsSync(g)) writeFileSync(g, "*\n"); },
};
