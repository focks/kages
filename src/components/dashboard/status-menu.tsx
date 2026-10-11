"use client";

// Status control: the lifecycle half of the detail actions (visibility lives in
// ShareMenu). It offers only the transitions valid from the current state — the
// same moves the store's LIFECYCLE_NEXT allows — each driven by the one operation
// set over REST (submit_for_review / unpublish_kage / deprecate_kage /
// archive_kage / restore_kage / delete_kage). Delete is irreversible, so it
// confirms first and is styled as destructive. Publishing itself stays in Share,
// since that's where the visibility is chosen.

import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { op } from "./kage-ui";

interface Action { op: string; label: string; danger?: boolean; confirm?: boolean }

const REVIEW: Action = { op: "submit_for_review", label: "Submit for review" };
const TO_DRAFT: Action = { op: "unpublish_kage", label: "Back to draft" };
const UNPUBLISH: Action = { op: "unpublish_kage", label: "Unpublish → draft" };
const DEPRECATE: Action = { op: "deprecate_kage", label: "Mark deprecated" };
const ARCHIVE: Action = { op: "archive_kage", label: "Archive" };
const RESTORE: Action = { op: "restore_kage", label: "Restore → published" };
const DELETE: Action = { op: "delete_kage", label: "Delete…", danger: true, confirm: true };

// Mirrors the store's LIFECYCLE_NEXT (plus delete, which isn't a state).
function actionsFor(state: string): Action[] {
  switch (state) {
    case "draft": return [REVIEW, ARCHIVE, DELETE];
    case "review": return [TO_DRAFT, ARCHIVE, DELETE];
    case "published": return [UNPUBLISH, DEPRECATE, ARCHIVE, DELETE];
    case "deprecated": return [RESTORE, ARCHIVE, DELETE];
    case "archived": return [RESTORE, DELETE];
    default: return [DELETE];
  }
}

export function StatusMenu({ name, state, onChanged, onDeleted }: {
  name: string; state: string; onChanged: () => void | Promise<void>; onDeleted: () => void | Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  async function run(a: Action) {
    if (a.confirm && !window.confirm(`Permanently delete “${name}”? This removes it and its history and can't be undone.`)) return;
    setBusy(true);
    try {
      await op(a.op, { name });
      const deleting = a.op === "delete_kage";
      toast.success(deleting ? `Deleted “${name}”` : "Status updated");
      await (deleting ? onDeleted() : onChanged());
    } catch (e) {
      toast.error(String((e as Error).message));
    } finally { setBusy(false); }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} Status <ChevronDown className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">Current state: <span className="capitalize text-foreground">{state}</span></div>
        <DropdownMenuSeparator />
        {actionsFor(state).map((a) => (
          <DropdownMenuItem key={a.op + a.label} onClick={() => run(a)} className={a.danger ? "text-danger focus:text-danger" : undefined}>
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
