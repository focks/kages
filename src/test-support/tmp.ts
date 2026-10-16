// Temp dirs that clean themselves up. Tests that leave directories behind make
// later runs depend on earlier ones (a stale .kages/ is a silent fixture).
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after } from "node:test";

const made: string[] = [];
let hooked = false;

/** A fresh temp dir, removed when the test file finishes. */
export function tmpDir(prefix = "kages-test-"): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  if (!hooked) {
    hooked = true;
    after(() => { for (const d of made.splice(0)) rmSync(d, { recursive: true, force: true }); });
  }
  return dir;
}

/** Run `fn` with a temp dir that is removed immediately afterwards, even on throw. */
export async function withTmp<T>(fn: (dir: string) => T | Promise<T>, prefix = "kages-test-"): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  try { return await fn(dir); } finally { rmSync(dir, { recursive: true, force: true }); }
}
