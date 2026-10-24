"use client";
// A thumbnail renders the listed immutable revision, rather than a decorative
// approximation. Offscreen frames are released so a long library does not keep
// dozens of React runtimes alive. All reads use the ordinary authorized API.
import { useEffect, useRef, useState } from "react";
import type { KageDoc } from "@/engine/types";
import { KageRenderer } from "@/runtime/SandboxedKage";
import { op } from "@/components/dashboard/kage-ui";

export function KageThumbnail({ uuid, version, gallery = false }: { uuid: string; version: number; gallery?: boolean }) {
  const element = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false), [width, setWidth] = useState(0);
  const [doc, setDoc] = useState<KageDoc | null>(null), [failed, setFailed] = useState(false);
  useEffect(() => {
    const el = element.current!;
    const intersection = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    const resize = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    intersection.observe(el); resize.observe(el);
    return () => { intersection.disconnect(); resize.disconnect(); };
  }, []);
  useEffect(() => {
    if (!visible || doc || failed) return;
    let disposed = false;
    op<KageDoc>(gallery ? "get_gallery_kage" : "get_kage", { uuid, version }).then(value => { if (!disposed) setDoc(value); }, () => { if (!disposed) setFailed(true); });
    return () => { disposed = true; };
  }, [visible, doc, failed, uuid, version, gallery]);
  return <div ref={element} data-kage-thumbnail={uuid} className="pointer-events-none relative aspect-[3/2] overflow-hidden rounded-md border bg-muted" aria-hidden="true" inert>
    {visible && doc && width > 0 ? <div style={{ width: 960, height: 640, transform: `scale(${width / 960})`, transformOrigin: "top left" }}><KageRenderer doc={doc} fill /></div> : <div className="grid h-full place-items-center text-xs text-muted-foreground">{failed ? "Preview unavailable" : "Preview"}</div>}
  </div>;
}
