// A throwaway HOME with the config dirs of the coding harnesses, so installer
// and hook tests can prove they never touch the real machine and preserve
// whatever the user already had in their settings files.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { after } from "node:test";
import { tmpDir } from "./tmp.ts";

export type HarnessId = "claude" | "cursor" | "codex" | "gemini";
export interface FakeHome {
  home: string;
  read(path: string): string;
  exists(path: string): boolean;
  write(path: string, content: string): void;
}

const DIRS: Record<HarnessId, string> = { claude: ".claude", cursor: ".cursor", codex: ".codex", gemini: ".gemini" };

/** `harnesses` maps a harness to extra pre-existing files (relative to its dir). Sets HOME/USERPROFILE until the file's tests finish. */
export function fakeHome(harnesses: Partial<Record<HarnessId, Record<string, string>>> = {}): FakeHome {
  const home = tmpDir("kages-home-");
  const write = (path: string, content: string) => {
    const full = join(home, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  for (const [id, files] of Object.entries(harnesses) as [HarnessId, Record<string, string>][]) {
    mkdirSync(join(home, DIRS[id]), { recursive: true });
    for (const [rel, content] of Object.entries(files ?? {})) write(join(DIRS[id], rel), content);
  }
  const prev = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  after(() => {
    for (const [k, v] of Object.entries(prev)) { if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  });
  return { home, write, read: (p) => readFileSync(join(home, p), "utf8"), exists: (p) => existsSync(join(home, p)) };
}
