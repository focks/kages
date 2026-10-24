"use client";

// Sign-in page (Google OAuth via Supabase). Reached only when auth is enabled —
// locally there's no login and nothing redirects here. If someone opens it on an
// install without the NEXT_PUBLIC Supabase vars, we say so rather than crash.

import { useState } from "react";
import { Button } from "@/components/ui/button";

const configured = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function LoginPage() {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const next = new URLSearchParams(window.location.search).get("next") || "/onboarding";
      await createClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
    } catch {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-background p-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-pop">
        <div className="mx-auto mb-4 grid size-10 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">Kg</div>
        <h1 className="font-display text-xl font-[650] tracking-[-0.01em]">Sign in to Kages</h1>
        <p className="mt-1 text-sm text-muted-foreground">An artifactory for agents.</p>
        {configured ? (
          <Button className="mt-6 w-full" onClick={signIn} disabled={busy}>
            {busy ? "Redirecting…" : "Continue with Google"}
          </Button>
        ) : (
          <p className="mt-6 text-sm text-destructive">Authentication isn’t configured on this deployment.</p>
        )}
      </div>
    </div>
  );
}
