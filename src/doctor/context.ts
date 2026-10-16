// Build a DoctorCtx from the real machine. Kept out of run.ts so the checks stay pure.
import { accessSync, constants, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { loadConfig } from "../config/load.ts";
import { inspect, repoRoot } from "../cli/gitignore.ts";
import type { Store } from "../store/store.ts";
import type { DoctorCtx, DoctorFs } from "./types.ts";

export const nodeDoctorFs: DoctorFs = {
  readText: (p) => { try { return readFileSync(p, "utf8"); } catch { return null; } },
  exists: (p) => existsSync(p),
  size: (p) => { try { return statSync(p).size; } catch { return null; } },
  isExecutable: (p) => { try { accessSync(p, constants.X_OK); return true; } catch { return false; } },
};

export function buildDoctorCtx(o: { dir: string; store: Store | null; author: { principal: string }; configHome: string; home?: string; env?: Record<string, string | undefined>; now?: number; ping?: DoctorCtx["ping"] }): DoctorCtx {
  const dir = resolve(o.dir), parent = dirname(dir);
  const root = repoRoot(parent) ?? parent;
  const info = repoRoot(parent) ? inspect(parent) : null;
  const env = o.env ?? process.env;
  return {
    dir, projectRoot: root, home: o.home ?? homedir(), env, now: o.now ?? Date.now(), fs: nodeDoctorFs,
    config: loadConfig({ readFile: (p) => nodeDoctorFs.readText(p), userFile: join(o.configHome, "config.json"), workspaceDir: dir, env }),
    store: o.store, author: o.author, nodeVersion: process.versions.node, ping: o.ping,
    git: info ? { status: info.status, tracked: info.tracked, file: info.file } : null,
  };
}
