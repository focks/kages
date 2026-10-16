// Run the real bin/kages.mjs as a child process, for behaviour that only exists
// across a process boundary (hooks read stdin, exit codes, no stderr noise). A
// hard timeout kills the whole process group: a leaked child hangs the test run.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const BIN = fileURLToPath(new URL("../../bin/kages.mjs", import.meta.url));

export interface SpawnResult { code: number | null; signal: string | null; out: string; err: string; timedOut: boolean }
export interface SpawnOptions { cwd?: string; env?: Record<string, string | undefined>; stdin?: string; timeoutMs?: number }

export function spawnKages(args: string[], opts: SpawnOptions = {}): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, ...opts.env } as NodeJS.ProcessEnv;
    for (const k of Object.keys(env)) if (env[k] === undefined) delete env[k];
    const child = spawn(process.execPath, [BIN, ...args], { cwd: opts.cwd, env, detached: true, stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "", timedOut = false;
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { err += d; });
    const timer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-child.pid!, "SIGKILL"); } catch { child.kill("SIGKILL"); }
    }, opts.timeoutMs ?? 10_000);
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code, signal) => { clearTimeout(timer); resolve({ code, signal, out, err, timedOut }); });
    child.stdin.on("error", () => { /* child exited before reading stdin */ });
    child.stdin.end(opts.stdin ?? "");
  });
}
