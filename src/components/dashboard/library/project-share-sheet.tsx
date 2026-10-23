"use client";

// "Share project": one link for every Kage in a project. The link lists what is published with a public link. Making
// everything visible is an explicit button ("Share all"), never a side effect of creating the link, because the person
// clicking is deciding who sees what.

import { useEffect, useState } from "react";
import { Check, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { op } from "@/components/dashboard/kage-ui";

type Share = { shared: boolean; uuid?: string; path?: string; title?: string };

export function ProjectShareSheet({ open, onOpenChange, repo, listed, total, onChanged }: { open: boolean; onOpenChange: (open: boolean) => void; repo: string; listed: number; total: number; onChanged?: () => void }) {
  const [share, setShare] = useState<Share | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = share?.path && typeof window !== "undefined" ? `${window.location.origin}${share.path}` : "";

  useEffect(() => {
    if (!open) return;
    setShare(null); setCopied(false);
    op<Share>("get_repo_share", { repo }).then(setShare).catch((e) => { toast.error(String((e as Error).message)); onOpenChange(false); });
  }, [open, repo, onOpenChange]);

  async function turnOn(all: boolean) {
    setBusy(true);
    try {
      const r = await op<{ uuid: string; path: string; title: string; published: string[]; skipped: Array<{ name: string }> }>("share_repo", { repo, ...(all ? { publish_all: true } : {}) });
      setShare({ shared: true, ...r });
      if (all) { toast.success(`Published ${r.published.length} Kage${r.published.length === 1 ? "" : "s"}${r.skipped.length ? `; ${r.skipped.length} skipped (invalid)` : ""}`); onChanged?.(); }
    }
    catch (e) { toast.error(String((e as Error).message)); } finally { setBusy(false); }
  }
  async function turnOff() {
    setBusy(true);
    try { await op("unshare_repo", { repo }); setShare({ shared: false }); toast.success("Link turned off"); }
    catch (e) { toast.error(String((e as Error).message)); } finally { setBusy(false); }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); toast.success("Link copied"); setTimeout(() => setCopied(false), 1500); }
    catch { toast.error("Couldn’t copy — select the link and copy it"); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-auto data-[side=right]:w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Share “{repo}”</SheetTitle>
          <SheetDescription>One link that shows every Kage in this project.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-4">
          {share === null && <p className="text-sm text-muted-foreground">Loading…</p>}
          {share?.shared && (
            <div className="space-y-2">
              <label htmlFor="project-link" className="text-sm font-medium">Project link</label>
              <div className="flex gap-2">
                <Input id="project-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 font-mono text-xs" />
                <Button variant="outline" onClick={() => void copy()} aria-label="Copy link">{copied ? <Check /> : <LinkIcon />}Copy</Button>
              </div>
              <p className="text-xs text-muted-foreground">Agents can read it as text at the same address with <span className="font-mono">.md</span> added.</p>
            </div>
          )}
          {share && !share.shared && <p className="text-sm">This project has no link yet.</p>}
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>The link lists the Kages that are <strong className="font-medium text-foreground">published</strong> with “Anyone with the link” or “Public” access. Right now that is {listed} of {total} in this project.</li>
            <li><strong className="font-medium text-foreground">Share all</strong> publishes every other live Kage in the project with a link, so they all appear at once. Without it, drafts and private Kages stay hidden. Later Kages join when you publish them; unpublishing removes one, with no new link.</li>
            <li>Anyone with the project link also gets the link of each listed Kage.</li>
          </ul>
          {share && (share.shared
            ? <Button variant="outline" disabled={busy} onClick={() => void turnOff()}>Turn link off</Button>
            : <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void turnOn(true)}>{busy ? "Creating…" : `Share all ${total} Kage${total === 1 ? "" : "s"}`}</Button>
                <Button variant="outline" disabled={busy} onClick={() => void turnOn(false)}>Link already-published only</Button>
              </div>)}
          {share?.shared && total > listed && <Button disabled={busy} onClick={() => void turnOn(true)}>Publish the other {total - listed} with a link</Button>}
        </div>
      </SheetContent>
    </Sheet>
  );
}
