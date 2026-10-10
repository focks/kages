// Session refresh for the edge middleware. Returns the (possibly cookie-updated)
// response AND the current user, so middleware.ts can both keep the session fresh
// and decide whether to redirect to /login. Standard @supabase/ssr pattern.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

export async function updateSession(request: NextRequest): Promise<{ response: NextResponse; user: User | null }> {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // getUser() revalidates the token with Supabase (don't trust getSession() in
  // middleware), and refreshes the cookie if needed.
  const { data: { user } } = await supabase.auth.getUser();
  return { response, user };
}
