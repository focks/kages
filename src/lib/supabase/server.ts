// Supabase server client for route handlers and server components — reads/writes
// the auth session from Next's cookie store. Uses the ANON key (public): auth is
// the user's own session, not a privileged service call. Only constructed when
// auth is enabled; callers guard with authEnabled().

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Server Components can't set cookies; the middleware refreshes the
          // session, so swallowing here is safe.
          try {
            for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    },
  );
}
