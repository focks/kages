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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const frame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

async function settle(): Promise<Settled> {
  // The design-system bundle loads asynchronously; the .kg-kage root appears when it has rendered.
  const deadline = Date.now() + 10_000;
  while (!document.querySelector(".kg-kage")) {
    if (Date.now() > deadline) return { ok: false, reason: "the design system did not load within 10 seconds" };
    await sleep(50);
  }
  await document.fonts.ready;
  await frame();
  const imgs = [...document.images].filter((i) => !i.complete);
  await Promise.race([Promise.all(imgs.map((i) => new Promise<void>((r) => { i.addEventListener("load", () => r(), { once: true }); i.addEventListener("error", () => r(), { once: true }); }))), sleep(4000)]);
  await sleep(150); // late layout (container queries, observers)
  await frame();
  return { ok: true };
}

export default function RenderPage() {
  const [job, setJob] = useState<Job | null>(null);
  const waiting = useRef<((r: Settled) => void) | null>(null);

  useEffect(() => {
    (window as unknown as { __kages: unknown }).__kages = {
      ready: true,
      render: (doc: KageDoc, opts: { system?: string; dark?: boolean } = {}) => new Promise<Settled>((resolve) => {
        document.documentElement.classList.toggle("dark", !!opts.dark);
        waiting.current = resolve;
        setJob({ doc, system: opts.system });
      }),
    };
  }, []);

  useEffect(() => {
    if (!job || !waiting.current) return;
    const done = waiting.current; waiting.current = null;
    void settle().then(done);
  }, [job]);

  return <div className="min-h-screen bg-background">{job && <KageRenderer key={job.doc.id + (job.system ?? "")} doc={job.doc} system={job.system} />}</div>;
}
