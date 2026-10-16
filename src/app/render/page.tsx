"use client";

// A bare page that renders exactly the Kage it is handed, for tools that need to
// look at one: `kages screenshot`, the MCP render tool, visual tests. It has no
// shell, no data access and no network of its own — the document arrives from the
// driving browser as an argument (window.__kages.render), so this route can be
// public without exposing anything. The returned promise resolves only once the
// design system, fonts and images have settled, so a screenshot taken right after
// is of the finished page and not a half-loaded one.

import { useEffect, useRef, useState } from "react";
import { KageRenderer } from "@/runtime/KageRenderer";
import type { KageDoc } from "@/engine/types";

interface Job { doc: KageDoc; system?: string }
interface Settled { ok: boolean; reason?: string }
export default function RenderPage() {
  const [job, setJob] = useState<Job | null>(null);
  const waiting = useRef<((r: Settled) => void) | null>(null);

  useEffect(() => {
    (window as unknown as { __kages: unknown }).__kages = {
      ready: true,
      render: (doc: KageDoc, opts: { system?: string; dark?: boolean } = {}) => new Promise<Settled>((resolve) => {
        document.documentElement.classList.toggle("dark", !!opts.dark);
        waiting.current?.({ ok: false, reason: "superseded by a newer render" });
        const timer = setTimeout(() => resolve({ ok: false, reason: "artifact frame did not settle within 10 seconds" }), 10000);
        waiting.current = result => { clearTimeout(timer); resolve(result); };
        setJob({ doc, system: opts.system });
      }),
    };
  }, []);


  return <div className="min-h-screen bg-background">{job && <KageRenderer key={job.doc.id + (job.system ?? "")} doc={job.doc} system={job.system} onMetrics={metrics => { (window as unknown as { __kages: { metrics: unknown } }).__kages.metrics = metrics; }} onReady={() => { waiting.current?.({ ok: true }); waiting.current = null; }} />}</div>;
}
