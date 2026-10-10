"use client";

// Signed-in user + sign-out, shown in the sidebar footer ONLY when auth is
// enabled (NEXT_PUBLIC Supabase vars present and a session exists). Local/dev
// renders nothing, so the chrome is unchanged there.

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

const enabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function UserMenu() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    import("@/lib/supabase/client").then(({ createClient }) =>
      createClient().auth.getUser().then(({ data }) => { if (live) setEmail(data.user?.email ?? null); }),
    );
    return () => { live = false; };
  }, []);

  if (!enabled || !email) return null;

  return (
    <form action="/auth/signout" method="post" className="flex items-center gap-2 px-2 py-1">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>{email}</span>
      <button type="submit" className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Sign out">
        <LogOut className="size-3.5" /> Sign out
      </button>
    </form>
  );
}
