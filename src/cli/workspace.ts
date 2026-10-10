// A local, on-disk artifactory for the CLI. The in-memory Store is the reference
// backend; this persists its snapshot to `<workspace>/store.json` so `kages`
// keeps versions, provenance and signatures across runs — the "persistent
// @kages/store backend behind the same interface" the architecture describes.
// Default workspace is ./.kages (override with --workspace or $KAGES_HOME).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import os from "node:os";
import { Store, type StoreSnapshot } from "../store/store.ts";
import type { Provenance, Grant } from "../store/types.ts";

const OWNER_GRANTS: Grant[] = ["read", "write", "review", "publish", "admin"];

export function workspaceDir(override?: string): string {
  return override ?? process.env.KAGES_HOME ?? join(process.cwd(), ".kages");
}

/** The local operator. Provenance records who wrote each version, so the CLI
 *  writes as `user:<login>` rather than anonymously. */
export function owner(): Provenance {
  let name = "local";
  try { name = os.userInfo().username || "local"; } catch { /* keep default */ }
  return { principal: `user:${name}`, runtime: { adapter: "cli" } };
}

const storePath = (dir: string) => join(dir, "store.json");

export function workspaceExists(dir: string): boolean {
  return existsSync(storePath(dir));
}

/** Load the workspace store (or a fresh one if none exists yet). The owner is
 *  always granted full rights on the `kages` repo so local commands just work. */
export function loadStore(dir: string): Store {
  const store = existsSync(storePath(dir))
    ? Store.restore(JSON.parse(readFileSync(storePath(dir), "utf8")) as StoreSnapshot)
    : new Store({ workspace: "local" });
  store.grant(owner().principal, "kages", OWNER_GRANTS);
  return store;
}

export function saveStore(dir: string, store: Store): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(storePath(dir), JSON.stringify(store.snapshot(), null, 2) + "\n");
}

export function initWorkspace(dir: string): void {
  mkdirSync(dir, { recursive: true });
  saveStore(dir, loadStore(dir));
}
