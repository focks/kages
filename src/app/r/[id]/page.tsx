"use client";

// The shareable project link: /r/<uuid>. One link for a folder of Kages. It lists only the Kages that are
// published with a public link right now, so it can neither reveal a private Kage nor go stale; each tile opens
// that Kage's own /k/<uuid> page. Access is decided by the server, never by this page.

import { use, useEffect, useState } from "react";
import { Folder } from "lucide-react";
import { MadeWithKages } from "@/components/dashboard/made-with-kages";

type Listing = { repo: string; title: string; items: Array<{ uuid: string; title: string; system: string; mode: string | null }> };

export default function SharedProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<Listing | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/shared-repo/${encodeURIComponent(id)}`)
      .then(async (r) => { const d = await r.json(); if (!r.ok) throw new Error(d?.error?.msg || r.statusText); return d as Listing; })
      .then(setData)
      .catch((e) => setErr(String((e as Error).message || e)));
  }, [id]);

  if (err) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-lg font-[650]">This project isn’t available</h1>
          <p className="mt-1 text-sm text-muted-foreground">{err} — the link may have been turned off.</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="grid min-h-svh place-items-center p-6 text-sm text-muted-foreground">Loading…</div>;

  return (
    <main className="mx-auto min-h-svh w-full max-w-5xl px-4 pb-24 pt-10 sm:px-6">
      <header className="flex items-center gap-2 text-muted-foreground">
        <Folder className="size-4" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">Shared project</span>
      </header>
      <h1 className="mt-1 break-words font-display text-2xl font-[650] tracking-[-0.015em]">{data.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{data.items.length} {data.items.length === 1 ? "Kage" : "Kages"}</p>
      {data.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">Nothing is published in this project yet.</p>
      ) : (
        <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((i) => (
            <li key={i.uuid} className="min-w-0">
              <a href={`/k/${i.uuid}`} className="block h-full min-w-0 rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                <span className="block break-words font-display text-[15px] font-[650] leading-snug">{i.title}</span>
                <span className="mt-2 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {i.system && <span className="font-mono">{i.system}</span>}
                  {i.mode && <span>{i.mode}</span>}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto"><MadeWithKages /></div>
      </div>
    </main>
  );
}
