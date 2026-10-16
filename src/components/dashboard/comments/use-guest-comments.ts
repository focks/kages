"use client";

// Comment mode for someone who opened a shared link and has no account. It speaks the same
// CommentsApi as the owner's discussion so the same stage (click anything, a comment window opens
// where you clicked) works unchanged, but it can only add: the notes go to the author through
// POST /api/shared/<uuid>/feedback, and the visitor sees back only the notes they placed this
// visit, as pins, never the author's discussion. Names are whatever was typed, so nothing here
// is identity.

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { CommentItem } from "./comment-model";
import type { CommentsApi } from "./use-comments";

export const GUEST_NAME_KEY = "kages.guest-name";

/** The note as the stage draws it: the visitor's own, read-only, with nothing to vote on or reply to. */
export function localNote(id: string, input: { text: string; block?: string; pos?: { x: number; y: number } }, name: string, now = new Date()): CommentItem {
  return { id, kage: "", block: input.block ?? "", author: `guest:${name}`, text: input.text, resolved: false, createdAt: now.toISOString(), ...(input.pos ? { pos: input.pos } : {}), score: 0, myVote: 0, canEdit: false, canDelete: false, canResolve: false, canVote: false };
}

export function useGuestComments(uuid: string): CommentsApi {
  const [mine, setMine] = useState<CommentItem[]>([]);
  const [name, setNameState] = useState("");
  // A remembered name is a convenience only; storage can be blocked, so every access is guarded.
  useEffect(() => { try { setNameState(localStorage.getItem(GUEST_NAME_KEY) ?? ""); } catch { /* private window */ } }, []);
  const setName = useCallback((v: string) => { setNameState(v); try { localStorage.setItem(GUEST_NAME_KEY, v.trim()); } catch { /* ignore */ } }, []);

  const post: CommentsApi["post"] = useCallback(async (input) => {
    if (input.parent) { toast.error("Guests can leave notes, not reply to threads"); return null; }
    const who = name.trim();
    if (!who) { toast.error("Add your name so the author knows who to thank"); return null; }
    try {
      const res = await fetch(`/api/shared/${encodeURIComponent(uuid)}/feedback`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: who, text: input.text.trim(), ...(input.block ? { block: input.block } : {}), ...(input.pos ? { x: input.pos.x, y: input.pos.y } : {}) }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error?.msg || res.statusText);
      const item = localNote(String(body.id), input, who);
      setMine((m) => [...m, item]);
      toast.success("Sent. The author will see this.");
      return item;
    } catch (e) { toast.error((e as Error).message || "Could not send"); return null; }
  }, [uuid, name]);

  const no = useCallback(async () => false, []);
  return useMemo(() => ({ comments: mine, loading: false, post, edit: no, remove: no, resolve: no, vote: no, reload: async () => {}, guest: { name, setName } }), [mine, post, no, name, setName]);
}
