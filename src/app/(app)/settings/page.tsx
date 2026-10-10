"use client";

// Settings: account + workspace. With auth on, you can rename your workspace
// (stored in Supabase user metadata, so no backend change) and sign out. With
// auth off (local/dev) there's no account — the shared "acme" workspace is shown
// read-only.

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const authEnabled = !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export default function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(!authEnabled);

  useEffect(() => {
    if (!authEnabled) return;
    let live = true;
    import("@/lib/supabase/client").then(({ createClient }) =>
      createClient().auth.getUser().then(({ data }) => {
        if (!live) return;
        const u = data.user;
        const m = u?.user_metadata ?? {};
        setEmail(u?.email ?? null);
        const n = (m.workspace_name as string) || (m.name as string) || u?.email || "";
        setName(n); setInitialName(n); setReady(true);
      }));
    return () => { live = false; };
  }, []);

  async function save() {
    setBusy(true);
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { error } = await createClient().auth.updateUser({ data: { workspace_name: name.trim() } });
      if (error) throw error;
      setInitialName(name.trim());
      toast.success("Workspace name updated");
    } catch (e) { toast.error(String((e as Error).message)); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-[22px] leading-7 font-[650] tracking-[-0.01em]">Settings</h1>
        <p className="text-sm text-muted-foreground">Your account and workspace.</p>
      </div>

      {!authEnabled ? (
        <Card className="p-5 text-sm text-muted-foreground">Sign-in isn’t enabled on this instance.</Card>
      ) : (
        <>
          <Card className="space-y-4 p-5">
            <h2 className="font-display text-base font-[650]">Workspace</h2>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">Display name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My workspace" disabled={!ready || busy} />
              <p className="text-xs text-muted-foreground">Shown in the sidebar. This renames the label only; your data stays in your own workspace.</p>
            </div>
            <Button size="sm" onClick={save} disabled={!ready || busy || !name.trim() || name.trim() === initialName}>Save</Button>
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-display text-base font-[650]">Account</h2>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Signed in as</dt>
              <dd className="font-mono">{email ?? "…"}</dd>
            </dl>
            <form action="/auth/signout" method="post">
              <Button size="sm" variant="outline" type="submit">Sign out</Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
