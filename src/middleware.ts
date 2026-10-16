// Edge middleware: when auth is enabled, refresh the Supabase session on every
// request and redirect signed-out users to /login — EXCEPT the public surfaces
// (/login, /auth/*, /docs/* the documentation, /k/* share links, /render which only shows a document it is handed, /api/* which gate themselves). When auth
// is OFF (no NEXT_PUBLIC Supabase vars, i.e. local/dev), this is a pass-through:
// no login, exactly today's behaviour.
//
// authEnabled is inlined (a plain env check) rather than imported from
// server/identity, to keep next/headers out of the edge bundle.

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function authEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const PUBLIC = ["/login", "/auth", "/k", "/api", "/render", "/docs"];

export async function middleware(request: NextRequest) {
  if (!authEnabled()) return NextResponse.next();

  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC.some((p) => path === p || path.startsWith(p + "/"));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Run on everything except static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)"],
};
