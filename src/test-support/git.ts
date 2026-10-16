// Real git repos for plans that care about what is tracked or ignored (the
// managed .gitignore block, tracked-runtime-file checks). Returns null when git
// is missing so callers can skip instead of failing on a bare CI image.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpDir } from "./tmp.ts";

export interface GitRepo {
  dir: string;
  git(...args: string[]): string;
  write(path: string, content: string): void;
  commitAll(message?: string): void;
  isIgnored(path: string): boolean;
  trackedFiles(): string[];
}

// Identity and config are passed explicitly: a developer's global config (signing,
// hooks, a different default branch) must not change what a test observes.
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_SYSTEM: "/dev/null", GIT_TERMINAL_PROMPT: "0" };
const ID = ["-c", "user.name=Kages Test", "-c", "user.email=test@kages.invalid", "-c", "commit.gpgsign=false", "-c", "init.defaultBranch=main"];

export function gitRepo(files: Record<string, string> = {}, opts: { commit?: boolean } = {}): GitRepo | null {
  try { execFileSync("git", ["--version"], { stdio: "ignore" }); } catch { return null; }
  const dir = tmpDir("kages-git-");
  const git = (...args: string[]) => execFileSync("git", [...ID, ...args], { cwd: dir, env: ENV, encoding: "utf8" });
  git("init", "-q");
  const write = (path: string, content: string) => {
    const full = join(dir, path);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  };
  for (const [p, c] of Object.entries(files)) write(p, c);
  const commitAll = (message = "test commit") => { git("add", "-A"); git("commit", "-q", "--allow-empty", "-m", message); };
  if (opts.commit && Object.keys(files).length) commitAll("initial");
  return {
    dir, git, write, commitAll,
    // check-ignore exits 1 for "not ignored", which execFileSync reports as a throw.
    isIgnored: (path) => { try { git("check-ignore", "-q", path); return true; } catch { return false; } },
    trackedFiles: () => git("ls-files").split("\n").filter(Boolean),
  };
}
