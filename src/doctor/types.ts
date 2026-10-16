// The doctor reports drift between the artifacts Kages writes and what this version reads,
// and says how to fix each finding without fixing anything itself unless asked. A check is
// a pure function of an injected context, so it is testable against fixtures.
import type { LoadedConfig } from "../config/load.ts";
import type { Store } from "../store/store.ts";

/** auto = the next ordinary write fixes it anyway; mention = worth knowing; route = run the named command. */
export type Severity = "auto" | "mention" | "route";
export type Area = "config" | "brief" | "store" | "hooks" | "gitignore" | "skills" | "critique" | "deprecations" | "bundle" | "env";

export interface DoctorFinding {
  id: string; severity: Severity; area: Area; message: string; evidence?: string;
  /** `safe` fixes are the only ones `--fix` applies. */
  fix?: { command: string; safe: boolean };
}

export interface DoctorFs {
  readText(path: string): string | null;
  exists(path: string): boolean;
  size(path: string): number | null;
  isExecutable(path: string): boolean;
}

export interface DoctorCtx {
  /** The workspace dir (holds store.json, config.json, brief.md). */
  dir: string;
  /** The project that contains it (git root or the workspace's parent). */
  projectRoot: string;
  home: string;
  env: Record<string, string | undefined>;
  now: number;
  fs: DoctorFs;
  config: LoadedConfig;
  store: Store | null;
  /** The principal reading the store, for permission-checked calls. */
  author: { principal: string };
  nodeVersion: string;
  /** Network-using checks run only when this is provided (`--online`). */
  ping?: (databaseUrl: string) => Promise<string | null>;
  /** git facts, injected so checks do not shell out: null when not a repository. */
  git: { status: "missing" | "stale" | "current" | "unbalanced"; tracked: string[]; file: string } | null;
}

export type Check = (ctx: DoctorCtx) => DoctorFinding[] | Promise<DoctorFinding[]>;
export interface DoctorReport { findings: DoctorFinding[]; ran: string[]; version: 1 }
