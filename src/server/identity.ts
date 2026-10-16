// Who is this request, and which workspace does it act in?
//
//  • Auth OFF (no NEXT_PUBLIC Supabase vars) → local/dev: no login, the demo
//    admin principal in the shared "acme" workspace. Exactly today's behaviour.
//  • Auth ON, signed in → the user's own principal (`user:<id>`) in their OWN
//    workspace (`ws-<id>`), isolated from other users.
//  • Auth ON, anonymous (e.g. following a public /k link) → an "anon" principal
//    with no grants, which the store's visibility gate limits to public content.
//
// This is the single place the hardcoded DEMO identity is replaced by a real one.

import type { Provenance } from "../store/types.ts";
import { DEMO_PRINCIPAL } from "./store-instance.ts";
import { createClient } from "../lib/supabase/server.ts";
import { authMode, closedModeNotice } from "./auth-mode.ts";

export function authEnabled(): boolean {
  return authMode() === "supabase";
}

let warned = false;
function warnOnceIfClosed(): void {
  if (warned) return;
  const notice = closedModeNotice();
  if (notice) { warned = true; console.error(notice); }
}

export const ANON_PRINCIPAL = "anon";
const ANON: Provenance = { principal: ANON_PRINCIPAL, runtime: { framework: "next", adapter: "rest" } };

/** On a deployment with auth enabled, an unauthenticated caller may READ public
 *  content but must never WRITE: the shared fallback workspace is unclaimed, and
 *  the store's first-writer-claims rule would otherwise hand "anon" admin on it —
 *  an open write surface for anyone. Locally (auth off) the writer is the demo
 *  admin, not anon, so this never blocks development. The gate lives at the write
 *  boundary (routes), before dispatch reaches the store's auto-grant. */
export function anonWriteBlocked(author: Provenance, isWrite: boolean): boolean {
  // Every mode but explicit local development: in `closed` mode (no auth configured, local mode not
  // requested) nobody has an identity, so nobody may write.
  return isWrite && authMode() !== "local" && author.principal === ANON_PRINCIPAL;
}

/** A workspace id from a user id. User ids are uuids (no slashes), so this is a
 *  safe segment for both the Supabase row key and the `kages://<ws>/…` ref. */
export function workspaceOf(userId: string): string {
  return "ws-" + userId;
}

export async function getSessionUser(req?: Request, bearerOnly = false) {
  if (!authEnabled()) return null;
  // A Bearer token (from the `kages` CLI after `auth login`) takes precedence
  // over the browser cookie session — verified against Supabase with the anon
  // key, so a forged token is rejected.
  const authz = req?.headers.get("authorization");
  if (authz?.startsWith("Bearer ")) {
    try {
      const { createClient: createJs } = await import("@supabase/supabase-js");
      const sb = createJs(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
      const { data } = await sb.auth.getUser(authz.slice(7));
      return data.user ?? null;
    } catch { return null; }
  }
  // Agent/CLI endpoints (MCP) pass bearerOnly so a browser's ambient cookie can
  // never authenticate a cross-site request to them (no CSRF-read surface).
  if (bearerOnly) return null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}

export interface Identity { author: Provenance; workspace: string; }

/** Resolve the acting identity + workspace for the current request. */
export async function resolveIdentity(req?: Request, bearerOnly = false): Promise<Identity> {
  const mode = authMode();
  if (mode === "local") return { author: DEMO_PRINCIPAL, workspace: "acme" };
  if (mode === "closed") { warnOnceIfClosed(); return { author: ANON, workspace: "acme" }; }
  const user = await getSessionUser(req, bearerOnly);
  if (!user) return { author: ANON, workspace: "acme" };
  return {
    author: { principal: `user:${user.id}`, runtime: { framework: "next", adapter: "rest" } },
    workspace: workspaceOf(user.id),
  };
}
