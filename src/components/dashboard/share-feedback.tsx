"use client";

// "Give feedback" on a shared Kage: a reviewer with only the link says who they are and what they
// noticed; it reaches the author's discussion as a guest comment (POST /api/shared/<uuid>/feedback).
// Chrome-token styled and outside the Kage's own scope. The reviewer never sees the author's
// private discussion: they see only the confirmation of what they sent.

import { useEffect, useState } from "react";
import { MessageSquarePlus, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aspects, checkFeedback, MAX_TEXT } from "./share-feedback-model.ts";
import type { KageDoc } from "@/engine/types.ts";

const NAME_KEY = "kages.guest-name";

export function ShareFeedback({ uuid, doc }: { uuid: string; doc: KageDoc }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [block, setBlock] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const where = aspects(doc);

  // A remembered name is a convenience only; storage can be blocked, so every access is guarded.
  useEffect(() => { try { setName(localStorage.getItem(NAME_KEY) ?? ""); } catch { /* private window */ } }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const problem = checkFeedback(name, text);
    if (problem) { setError(problem); return; }
    setError(null); setState("sending");
    try {
      const res = await fetch(`/api/shared/${encodeURIComponent(uuid)}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: name.trim(), text: text.trim(), ...(block ? { block } : {}) }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.msg || res.statusText);
      try { localStorage.setItem(NAME_KEY, name.trim()); } catch { /* ignore */ }
      setState("sent"); setText("");
    } catch (err) { setState("idle"); setError((err as Error).message); }
  }

  if (!open) return (
    <Button variant="outline" size="sm" className="fixed bottom-4 right-4 z-40 bg-background/90 shadow-pop backdrop-blur" onClick={() => { setOpen(true); setState("idle"); }}>
      <MessageSquarePlus aria-hidden /> Give feedback
    </Button>
  );
  return (
    <form onSubmit={send} aria-label="Give feedback" className="fixed bottom-4 right-4 z-40 w-[min(22rem,calc(100vw-2rem))] rounded-xl border bg-background p-4 shadow-pop">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-[650]">Give feedback</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label="Close feedback" className="rounded-md p-1 text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"><X className="size-4" aria-hidden /></button>
      </div>
      {state === "sent" ? (
        <div className="space-y-3 text-sm" role="status">
          <p className="flex items-center gap-2"><Check className="size-4 text-success" aria-hidden /> Thanks, {name.trim()}. The author will see this.</p>
          <Button type="button" variant="outline" size="sm" onClick={() => setState("idle")}>Add another</Button>
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <label className="block">Your name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" />
          </label>
          {where.length > 0 && (
            <label className="block">About
              <select value={block} onChange={(e) => setBlock(e.target.value)} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                <option value="">The whole page</option>
                {where.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
          )}
          <label className="block">What did you notice?
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={MAX_TEXT} className="mt-1 block w-full rounded-md border bg-background px-2 py-1.5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none" />
          </label>
          {error && <p role="alert" className="text-destructive">{error}</p>}
          <Button type="submit" size="sm" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send feedback"}</Button>
          <p className="text-xs text-muted-foreground">Only the author sees this. You are not signed in, so your name is not verified.</p>
        </div>
      )}
    </form>
  );
}
