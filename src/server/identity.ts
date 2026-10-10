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

export function authEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const ANON: Provenance = { principal: "anon", runtime: { framework: "next", adapter: "rest" } };

/** A workspace id from a user id. User ids are uuids (no slashes), so this is a
 *  safe segment for both the Supabase row key and the `kages://<ws>/…` ref. */
export function workspaceOf(userId: string): string {
  return "ws-" + userId;
}

export async function getSessionUser() {
  if (!authEnabled()) return null;
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
export async function resolveIdentity(): Promise<Identity> {
  if (!authEnabled()) return { author: DEMO_PRINCIPAL, workspace: "acme" };
  const user = await getSessionUser();
  if (!user) return { author: ANON, workspace: "acme" };
  return {
    author: { principal: `user:${user.id}`, runtime: { framework: "next", adapter: "rest" } },
    workspace: workspaceOf(user.id),
  };
}
