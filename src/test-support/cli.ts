// Run the CLI in-process with captured output. Process-wide state (streams,
// env, cwd) is swapped and ALWAYS restored in `finally`: a test that throws
// inside main() must not leave stdout replaced for every later test.
import { main } from "../cli/kages.ts";
import { tmpDir } from "./tmp.ts";

export interface CliResult { code: number; out: string; err: string }
export interface CliOptions { env?: Record<string, string | undefined>; cwd?: string }

// Isolation defaults: never read or write a real session, workspace or home.
let isolated: Record<string, string> | null = null;
function isolation(): Record<string, string> {
  if (!isolated) isolated = { KAGES_CONFIG_HOME: tmpDir("kages-cfg-") };
  return isolated;
}

export async function runCli(argv: string[], opts: CliOptions = {}): Promise<CliResult> {
  // The test reporter writes its results through process.stdout.write; let those pending writes flush
  // before the swap below, or an earlier test's result line is captured here and the runner undercounts.
  await new Promise<void>((r) => setImmediate(r));
  const realOut = process.stdout.write; // the original function, not a bound copy, so identity survives the swap
  const realErr = process.stderr.write;
  const cwd = process.cwd();
  const env: Record<string, string | undefined> = { ...isolation(), ...opts.env };
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(env)) { saved[k] = process.env[k]; if (env[k] === undefined) delete process.env[k]; else process.env[k] = env[k]; }
  let out = "", err = "";
  (process.stdout.write as unknown as (s: string) => boolean) = (s: string) => { out += s; return true; };
  (process.stderr.write as unknown as (s: string) => boolean) = (s: string) => { err += s; return true; };
  try {
    if (opts.cwd) process.chdir(opts.cwd);
    const code = await main(argv);
    return { code, out, err };
  } finally {
    process.stdout.write = realOut;
    process.stderr.write = realErr;
    process.chdir(cwd);
    for (const k of Object.keys(saved)) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  }
}
