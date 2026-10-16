// How a deployment identifies callers, decided once from the environment and failing closed.
//
//   supabase  both public Supabase variables are set: real users, each in their own workspace.
//   local     no Supabase, and the operator said so (KAGES_LOCAL_MODE=1, or `next dev`): every caller is the
//             demo admin of the shared "acme" workspace, which is what development wants.
//   closed    no Supabase and no explicit local mode: callers are anonymous and cannot write. A deployment
//             that lost a variable (a typo, a missing secret on a new environment) must degrade to read-only,
//             never to an open admin on a workspace that may be backed by a real database.
//
// The environment is a parameter so the three outcomes are tested without touching process.env.
export type AuthMode = "supabase" | "local" | "closed";
type Env = Record<string, string | undefined>;

export function authMode(env: Env = process.env): AuthMode {
  if (env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return "supabase";
  if (env.KAGES_LOCAL_MODE === "1" || env.NODE_ENV === "development") return "local";
  return "closed";
}

/** Why a request got no identity, for the one-time log line an operator needs. */
export function closedModeNotice(env: Env = process.env): string | null {
  if (authMode(env) !== "closed") return null;
  const half = !!env.NEXT_PUBLIC_SUPABASE_URL !== !!env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return `[kages] authentication is not configured${half ? " (only one of NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY is set)" : ""} and local mode was not requested: the app is read-only. Set both Supabase variables, or KAGES_LOCAL_MODE=1 for a local run.`;
}
