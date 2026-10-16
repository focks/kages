"use client";

// The first-use path, shown inside the docs at /docs/build-a-guide: pick an example, make it yours
// in three fields, and open the finished guide. It lives with the documentation rather than as an
// app destination because it is a one-time lesson, not a place you return to. It builds through the
// same operations an agent uses (decision_guide_to_kage, then create_kage).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { op, type KageCard } from "@/components/dashboard/kage-ui";
import { agentPrompt, checkEdits, connectCommands, intakeFrom, starters } from "@/components/dashboard/guide/guide-model";

function CopyBox({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-start gap-2 rounded-md border bg-muted p-2">
        <code className="min-w-0 flex-1 break-words font-mono text-xs">{text}</code>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Copy: ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}>
          {done ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export function GuideBuilder() {
  const router = useRouter();
  const list = useMemo(() => starters(), []);
  const [key, setKey] = useState(list[0].key);
  const chosen = list.find((s) => s.key === key)!;
  const [edits, setEdits] = useState({ title: "", reader: "", summary: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("http://localhost:3000");
  useEffect(() => setOrigin(window.location.origin), []);

  async function build() {
    const problem = checkEdits(edits);
    if (problem) { setError(problem); return; }
    setBusy(true); setError(null);
    try {
      const existing = (await op<KageCard[]>("list_kages")).map((c) => c.name);
      const built = await op<{ doc: unknown; problems: string[] }>("decision_guide_to_kage", { intake: intakeFrom(key, edits, existing) });
      if (!built.doc) throw new Error(built.problems.join("; "));
      const made = await op<{ version: { ref: string }; name?: string }>("create_kage", { doc: built.doc });
      const id = (built.doc as { id: string }).id;
      void made;
      router.push(`/artifacts?id=${encodeURIComponent(id)}`);
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="space-y-8">
      <section aria-labelledby="pick" className="space-y-3">
        <h3 id="pick" className="text-sm font-medium">1. Start from an example</h3>
        <div role="radiogroup" aria-labelledby="pick" className="grid gap-3 sm:grid-cols-3">
          {list.map((s) => (
            <button key={s.key} type="button" role="radio" aria-checked={s.key === key} onClick={() => setKey(s.key)}
              className={`rounded-xl border p-4 text-left transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none ${s.key === key ? "border-primary bg-primary-soft" : "hover:bg-accent"}`}>
              <div className="text-xs text-muted-foreground">{s.subject}</div>
              <div className="mt-1 font-display text-[15px] font-[650] leading-snug">{s.title}</div>
              <p className="mt-2 text-sm text-muted-foreground">{s.summary}</p>
              <p className="mt-2 text-xs text-muted-foreground">{s.facts}</p>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="own" className="space-y-3">
        <h3 id="own" className="text-sm font-medium">2. Make it yours</h3>
        <div className="grid gap-3 text-sm">
          {([["title", "Title", chosen.title], ["reader", "Who is it for?", chosen.reader], ["summary", "One-sentence summary", chosen.summary]] as const).map(([k, label, ph]) => (
            <label key={k} className="block">{label}
              <input value={edits[k]} onChange={(e) => setEdits({ ...edits, [k]: e.target.value })} placeholder={ph} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">The facts, numbers and steps come from the example and are placeholders until you or your agent replace them. The guide says it is not yet verified until you confirm them.</p>
        {error && <p role="alert" className="text-sm text-destructive">{error} <a href="/artifacts" className="underline underline-offset-4">Open the app</a> to sign in or check your workspace.</p>}
        <Button onClick={build} disabled={busy}><Sparkles aria-hidden /> {busy ? "Building…" : "Build my guide"} <ArrowRight aria-hidden /></Button>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>3. Or let your own agent write it</CardTitle>
          <CardDescription>Connect the agent you already use, then paste the request. It fills the same guide from your notes.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {connectCommands(origin).map((c) => <CopyBox key={c.label} label={c.label} text={c.command} />)}
          <CopyBox label="Then ask your agent" text={agentPrompt()} />
        </CardContent>
      </Card>
    </div>
  );
}
