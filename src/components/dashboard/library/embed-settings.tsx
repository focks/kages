"use client";
// The published revision owns the policy. Editing these origins creates a draft
// so an unfinished policy cannot silently alter an already shared version.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { op } from "@/components/dashboard/kage-ui";
import { publishedEmbedOrigins } from "@/store/embed-policy";
import type { KageDoc } from "@/engine/types";

export function EmbedSettings({ name, version, doc, onChanged }: { name: string; version: number; doc: KageDoc; onChanged: () => Promise<void> }) {
  const [text, setText] = useState(""), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  useEffect(() => { setText(publishedEmbedOrigins(doc.meta).join("\n")); setMessage(""); }, [name, doc.meta]);
  async function save() {
    setBusy(true); setMessage("");
    try {
      await op("set_embed_policy", { name, origins: text.split(/\r?\n/).map(line => line.trim()).filter(Boolean), baseVersion: version });
      await onChanged(); setMessage("Saved in a new draft. Publish that version to activate this policy.");
    } catch (e) { setMessage((e as Error).message); } finally { setBusy(false); }
  }
  return <details className="rounded-xl border p-3">
    <summary className="cursor-pointer text-sm font-medium">Website embedding</summary>
    <p className="my-3 text-sm text-muted-foreground">Allow this Kage on specific websites. Use one exact HTTPS origin per line, such as https://example.com. An empty list disables embedding. The embedded viewer has no dashboard controls or host services.</p>
    <label className="block text-xs">Allowed website origins<textarea className="mt-1 block w-full rounded-md border border-input bg-background p-2 font-mono text-xs" rows={3} value={text} disabled={busy} onChange={event => setText(event.target.value)} /></label>
    <Button className="mt-3" variant="outline" size="sm" disabled={busy} onClick={() => void save()}>Save embed policy</Button>
    {message && <p role="status" className="mt-2 text-xs text-muted-foreground">{message}</p>}
  </details>;
}
