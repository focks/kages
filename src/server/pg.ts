// Plain-Postgres backend, selected by DATABASE_URL. It serves the same two
// tables the Supabase REST backend uses (kages_state, public_shares) so the
// store, CAS retry loop and public-share registry behave identically against
// either. The pool lives on globalThis because Next dev re-evaluates modules on
// every route compile; a module-level pool would leak a new set of connections
// each time and eventually exhaust the server's max_connections.

import pg from "pg";

const holder = globalThis as { __kagesPgPool?: { url: string; pool: pg.Pool } };

/** True when a Postgres connection string is configured. Read at call time, not
 *  import time, so tests and scripts can set the variable after loading. */
export function pgEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

/** The shared pool, rebuilt if the URL changes (tests point at a throwaway
 *  database). A small max keeps a dev machine's shared server healthy. */
export function pool(): pg.Pool {
  const url = process.env.DATABASE_URL!;
  if (holder.__kagesPgPool && holder.__kagesPgPool.url !== url) {
    void holder.__kagesPgPool.pool.end().catch(() => {});
    holder.__kagesPgPool = undefined;
  }
  if (!holder.__kagesPgPool) {
    const p = new pg.Pool({ connectionString: url, max: 5, idleTimeoutMillis: 10_000 });
    // An idle-client error (server restart) must not crash the process.
    p.on("error", (e) => console.error("pg pool error:", e.message));
    holder.__kagesPgPool = { url, pool: p };
  }
  return holder.__kagesPgPool.pool;
}

/** Release connections (tests, scripts). */
export async function closePool(): Promise<void> {
  const h = holder.__kagesPgPool;
  holder.__kagesPgPool = undefined;
  if (h) await h.pool.end().catch(() => {});
}
