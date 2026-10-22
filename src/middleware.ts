// Edge middleware: when auth is enabled, refresh the Supabase session on every
// request and redirect signed-out users to /login — EXCEPT the public surfaces
// (/login, /auth/*, /docs/* the documentation, /k/* share links, /render which only shows a document it is handed, /api/* which gate themselves). When auth
// is OFF (no NEXT_PUBLIC Supabase vars, i.e. local/dev), this is a pass-through:
// no login, exactly today's behaviour. The apex host (getkages.com) serves the
// public /landing page at the root with no auth.
//
// authEnabled is inlined (a plain env check) rather than imported from
// server/identity, to keep next/headers out of the edge bundle.

import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function authEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const PUBLIC = ["/login", "/auth", "/k", "/api", "/render", "/docs", "/landing"];

// The apex host is the public marketing site; app.getkages.com (and the
// *.vercel.app default) is the dashboard. Matched here rather than in
// vercel.json so the rewrite and the auth check are decided in one place —
// no dependence on the platform-rewrite-vs-middleware ordering.
const APEX = /^(www\.)?getkages\.com$/;

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // getkages.com/ → the landing page, with no auth, before any session check.
  if (path === "/" && APEX.test(request.headers.get("host") ?? "")) {
    const url = request.nextUrl.clone();
    url.pathname = "/landing";
    return NextResponse.rewrite(url);
  }

  if (!authEnabled()) return NextResponse.next();

  const { response, user } = await updateSession(request);
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
