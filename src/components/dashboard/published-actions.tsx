"use client";
// Public viewing stays anonymous. Saving a copy uses the ordinary create API,
// so destination workspace permissions and quotas remain authoritative.
import { kageMarkdown } from "@/export/markdown";
import { useState } from "react";
import type { KageDoc, Json } from "@/engine/types";
import { Button } from "@/components/ui/button";
import { publishedEmbedOrigins } from "@/store/embed-policy";
import { docWithSharedView, shareKeys, viewHash } from "@/runtime/shared-view";
import { ShareFeedback } from "./share-feedback";
import { DataSessionNotice } from "./data-session-notice";

export function PublishedActions({ doc, uuid, readerState, onPresent }: { doc: KageDoc; uuid: string; readerState?: () => Record<string, Json> | undefined; onPresent?: () => void }) {
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  const [markdownFallback, setMarkdownFallback] = useState<string | null>(null);
  const [copyingMarkdown, setCopyingMarkdown] = useState(false);
  const [login, setLogin] = useState(false);
  const origins = publishedEmbedOrigins(doc.meta);
  async function copyView() {
    const url = new URL(location.href);
    url.hash = viewHash(doc, readerState?.() ?? docWithSharedView(doc, url.hash).state ?? {}, url.hash);
    try { await navigator.clipboard.writeText(url.href); setMessage(shareKeys(doc).length ? "Link copied with the chapter and shareable control values. Imported data and private state are excluded." : "Link copied, including the selected chapter."); }
    catch { setMessage("Clipboard access is unavailable. Copy the page address to share its starting view."); }
  }
  async function copyMarkdown() {
    setCopyingMarkdown(true); setMessage(""); setMarkdownFallback(null);
    try {
      const exported = kageMarkdown(doc, readerState?.() ?? docWithSharedView(doc, location.hash).state);
      const markdown = exported.markdown + (exported.notes.length ? "\n" + exported.notes.map(note => "> " + note).join("\n") + "\n" : "");
      try { await navigator.clipboard.writeText(markdown); setMessage("Markdown copied from the current view. Charts are tables; interactions stay in Kages."); }
      catch { setMarkdownFallback(markdown); setMessage("Clipboard access is unavailable. Select and copy the Markdown below."); }
    } catch (e) { setMessage((e as Error).message); }
    finally { setCopyingMarkdown(false); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = "kage-" + uuid + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copy() {
    setBusy(true); setMessage(""); setLogin(false);
    // Source workspace design IDs are not portable permissions. The copy uses
    // the destination's default design; the download retains the original pin.
    const { resolved: _resolved, design: _design, ...content } = doc;
    if (content.meta && typeof content.meta === "object" && !Array.isArray(content.meta)) {
      const { embedOrigins: _policy, ...otherMetadata } = content.meta;
      content.meta = otherMetadata;
    }
    const id = "copy-" + crypto.randomUUID();
    try {
      const response = await fetch("/api/create_kage", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ doc: { ...content, id, title: (doc.title || "Kage") + " copy" } }) });
      const result = await response.json();
      if (response.status === 401) { setLogin(true); setMessage("Sign in to save a copy to your workspace. Viewing and downloading do not require sign-in."); return; }
      if (!response.ok) throw new Error(result?.error?.msg || "Could not create a copy.");
      location.assign("/artifacts?id=" + encodeURIComponent(id));
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="relative shrink-0">
    <summary className="cursor-pointer rounded-md border border-input px-2 py-1 text-xs">Use this Kage</summary>
    <div className="absolute right-0 top-full z-30 mt-2 max-h-[80svh] w-72 space-y-3 overflow-auto rounded-xl border bg-popover p-4 text-popover-foreground shadow-md">
      <p className="text-xs text-muted-foreground">Explore freely. A copy is an independent draft in your workspace and uses your workspace’s design.</p>
      <div className="flex flex-col items-stretch gap-2">
        {onPresent && <Button variant="outline" size="sm" onClick={event => { event.currentTarget.closest("details")?.removeAttribute("open"); onPresent(); }}>Presentation mode</Button>}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void copy()}>Make a copy</Button>
        <Button variant="outline" size="sm" disabled={copyingMarkdown} onClick={() => void copyMarkdown()}>{copyingMarkdown ? "Copying Markdown…" : "Copy as Markdown"}</Button>
        <Button variant="outline" size="sm" onClick={download}>Download Kage JSON</Button>
        <a className="rounded-md border border-input px-3 py-2 text-center text-sm" href={`/k/${encodeURIComponent(uuid)}?print=1`} target="_blank" rel="noopener noreferrer">Print / save PDF</a>
        <button className="rounded-md border border-input px-3 py-2 text-sm" onClick={() => void copyView()}>Copy link to this view</button>
        {origins.length > 0 && <button className="rounded-md border border-input px-3 py-2 text-sm" onClick={() => { const code = `<iframe src="${location.origin}/embed/${encodeURIComponent(uuid)}" title="Kage artifact" width="100%" height="720" loading="lazy" referrerpolicy="no-referrer"></iframe>`; navigator.clipboard.writeText(code).then(() => setMessage("Embed code copied. Allowed websites: " + origins.join(", ")), () => setMessage("Clipboard access is unavailable.")); }}>Copy embed code</button>}
      </div>
      <p className="text-xs text-muted-foreground">Markdown copies text and data from the current view, including all table rows and expandable content.</p>
      <ShareFeedback uuid={uuid} doc={doc} inline />
      <DataSessionNotice doc={doc} />
      <a href="/" className="block text-xs text-muted-foreground">Made with Kages</a>
      {markdownFallback !== null && <label className="block text-xs">Markdown to copy<textarea readOnly value={markdownFallback} onFocus={event => event.currentTarget.select()} className="mt-2 h-40 w-full rounded-md border border-input p-2 font-mono text-xs" /></label>}
      {message && <p role="status" className="text-xs">{message}</p>}
      {login && <a className="text-sm text-wire underline" href={`/login?next=${encodeURIComponent(`/k/${uuid}`)}`}>Sign in</a>}
    </div>
  </details>;
}
