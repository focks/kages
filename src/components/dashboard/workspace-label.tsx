"use client";

// The workspace identifier under the "Kages" title. When auth is on it shows the
// signed-in user (their own workspace); locally it's the shared "acme" demo
// workspace. Keeps the chrome honest instead of always claiming "acme".

import { useEffect, useState } from "react";

const enabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function WorkspaceLabel() {
  const [label, setLabel] = useState(enabled ? "…" : "workspace acme");

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    import("@/lib/supabase/client").then(({ createClient }) =>
      createClient().auth.getUser().then(({ data }) => {
        if (!live) return;
        const u = data.user;
        const m = u?.user_metadata ?? {};
        setLabel(u ? (m.workspace_name as string) || (m.name as string) || u.email || "your workspace" : "signed out");
      }),
    );
    return () => { live = false; };
  }, []);

  return <div className="max-w-[150px] truncate font-mono text-[11px] text-muted-foreground" title={label}>{label}</div>;
}
