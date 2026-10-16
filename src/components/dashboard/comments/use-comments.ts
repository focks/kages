"use client";

// The discussion for one Kage, over the operation set like any other client:
// list_comments to read, comment / edit_comment / delete_comment /
// resolve_comment / vote_comment to write. It refreshes after every action and
// polls gently while the tab is visible, so a teammate's reply shows up without
// a reload. Failures surface the server's own message (it explains the rule).

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { op } from "@/components/dashboard/kage-ui";
import type { CommentItem } from "./comment-model";

const POLL_MS = 20_000;

export interface CommentsApi {
  comments: CommentItem[];
  loading: boolean;
  post: (input: { text: string; block?: string; parent?: string; pos?: { x: number; y: number } }) => Promise<CommentItem | null>;
  edit: (id: string, text: string) => Promise<boolean>;
  remove: (id: string) => Promise<boolean>;
  resolve: (id: string, resolved: boolean) => Promise<boolean>;
  vote: (id: string, value: 1 | -1 | 0) => Promise<boolean>;
  reload: () => Promise<void>;
  /** Present for a visitor with no account: they can add notes and nothing else (no replies, votes or edits), and are asked for a name. */
  guest?: { name: string; setName: (v: string) => void };
}

export function useComments(kage: string | null): CommentsApi {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const current = useRef(kage);
  current.current = kage;

  const reload = useCallback(async () => {
    const name = current.current;
    if (!name) return;
    try {
      const list = await op<CommentItem[]>("list_comments", { kage: name });
      if (current.current === name) setComments(list); // ignore a response for a Kage we have since left
    } catch { /* a failed background refresh keeps the last good list */ }
  }, []);

  useEffect(() => {
    setComments([]);
    if (!kage) return;
    setLoading(true);
    reload().finally(() => setLoading(false));
    const timer = setInterval(() => { if (document.visibilityState === "visible") void reload(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [kage, reload]);

  /** Run a write; on success refresh, on failure show the server's reason. */
  const act = useCallback(async <T,>(name: string, params: Record<string, unknown>): Promise<T | null> => {
    try { const r = await op<T>(name, params); await reload(); return r; }
    catch (e) { toast.error((e as Error).message || "Something went wrong"); return null; }
  }, [reload]);

  return {
    comments, loading, reload,
    // The operation takes the pin as flat x/y (so it is natural over REST, MCP and
    // the CLI); the UI works with a {x,y} object.
    post: ({ pos, ...rest }) => act<CommentItem>("comment", { kage, ...rest, ...(pos ? { x: pos.x, y: pos.y } : {}) }),
    edit: async (id, text) => (await act("edit_comment", { id, text })) !== null,
    remove: async (id) => (await act("delete_comment", { id })) !== null,
    resolve: async (id, resolved) => (await act("resolve_comment", { id, resolved })) !== null,
    vote: async (id, value) => (await act("vote_comment", { id, value })) !== null,
  };
}
