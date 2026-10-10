"use client";

// The signed-in user at the bottom of the sidebar: avatar + name + email, with
// Settings and Sign out. Only rendered when auth is enabled and a session
// exists; locally it collapses to a plain Settings link, so the chrome stays
// clean and never leaks configuration details.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, LogOut } from "lucide-react";

const enabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function UserMenu() {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    import("@/lib/supabase/client").then(({ createClient }) =>
      createClient().auth.getUser().then(({ data }) => {
        if (!live) return;
        const u = data.user;
        if (!u) return;
        const m = u.user_metadata ?? {};
        setUser({ email: u.email ?? "", name: (m.workspace_name as string) || (m.name as string) || u.email || "" });
      }),
    );
    return () => { live = false; };
  }, []);

  if (!enabled) {
    return (
      <Link href="/settings" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-sidebar-accent hover:text-foreground">
        <Settings className="size-4" /> Settings
      </Link>
    );
  }
  if (!user) return null;

  const initial = (user.name || user.email || "?").charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2 rounded-md px-2 py-1.5">
      <div aria-hidden className="grid size-7 shrink-0 place-items-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">{initial}</div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="truncate text-sm font-medium" title={user.name}>{user.name}</div>
        <div className="truncate text-xs text-muted-foreground" title={user.email}>{user.email}</div>
      </div>
      <Link href="/settings" aria-label="Settings" className="rounded-sm p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><Settings className="size-4" /></Link>
      <form action="/auth/signout" method="post">
        <button type="submit" aria-label="Sign out" className="rounded-sm p-1 text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"><LogOut className="size-4" /></button>
      </form>
    </div>
  );
}
