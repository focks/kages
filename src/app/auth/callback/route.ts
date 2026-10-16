// OAuth callback: exchange the code for a session cookie, then ONBOARD the user
// by touching their workspace (getStore seeds it with the intro templates on
// first access), and send them on to where they were headed.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStore } from "@/server/store-instance";
import { workspaceOf } from "@/server/identity";
import { safeNext } from "@/server/web-safety";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") || "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // First login seeds the user's own workspace (templates); later logins are
      // a no-op because the workspace already exists.
      try { await getStore(workspaceOf(data.user.id)); } catch { /* onboarding is best-effort */ }
      // `next` came from the query string: only a local path may be followed (see safeNext).
      return NextResponse.redirect(safeNext(next, origin));
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
