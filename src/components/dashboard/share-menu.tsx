"use client";

// Share control: set a Kage's permission level and copy its publishable link.
// The four levels ARE the store's Visibility enum — nothing new invented here,
// the menu just drives publish_kage / share_kage over the same REST operations
// any agent uses (see dashboard-over-adapters). Setting a level on a draft
// publishes it at that visibility (requires clean validation); on an already
// published Kage it widens/narrows visibility via share_kage. The link is only
// handed out when the level actually permits link access, so the UI never shows
// a URL that would 404 for the recipient.

import { useState } from "react";
import { Share2, Link as LinkIcon, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { op } from "./kage-ui";

// Ordered widest-last. `label` is the user's word; `hint` says who can see.
const LEVELS: { value: string; label: string; hint: string }[] = [
  { value: "private", label: "Private", hint: "Only you and repo editors" },
  { value: "workspace", label: "Workspace", hint: "Anyone in the workspace" },
  { value: "link", label: "Anyone with the link", hint: "View-only, no sign-in" },
  { value: "public", label: "Public", hint: "Listed and viewable by anyone" },
];

const LINKABLE = new Set(["link", "public"]);

export function ShareMenu({ name, uuid, state, visibility, onChanged }: {
  name: string; uuid: string; state: string; visibility: string; onChanged: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  // The link uses the opaque uuid, never the name slug — so it doesn't reveal
  // the Kage's identity and isn't guessable.
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/k/${uuid}` : "";

  async function setLevel(level: string) {
    if (level === visibility && state === "published") return;
    setBusy(true);
    try {
      // A draft has no visibility to widen yet — publish it at this level.
      // An already-published Kage just changes visibility via share_kage.
      await op(state === "published" ? "share_kage" : "publish_kage", { name, visibility: level });
      toast.success(`Permission set to “${LEVELS.find((l) => l.value === level)?.label}”`);
      await onChanged();
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally { setBusy(false); }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); toast.success("Link copied"); }
    catch { toast.error("Couldn’t copy — copy it from the address bar"); }
  }

  const published = state === "published";
  const linkable = published && LINKABLE.has(visibility);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>
        <Share2 className="size-4" /> Share
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Permission level</div>
        <DropdownMenuRadioGroup value={published ? visibility : ""} onValueChange={setLevel}>
          {LEVELS.map((l) => (
            <DropdownMenuRadioItem key={l.value} value={l.value} className="items-start py-1.5">
              <span className="flex flex-col">
                <span>{l.label}</span>
                <span className="text-xs text-muted-foreground">{l.hint}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {linkable ? (
          <>
            <div className="truncate px-2 py-1 font-mono text-xs text-muted-foreground">{shareUrl}</div>
            <DropdownMenuItem onClick={copyLink}><LinkIcon className="size-4" /> Copy link</DropdownMenuItem>
          </>
        ) : (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {published ? (
              <>Set <Check className="inline size-3" /> “Anyone with the link” or “Public” to get a shareable link.</>
            ) : "Publishing is required before a Kage can be shared."}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
