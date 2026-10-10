"use client";

// Raw-JSON editing of the whole document, beside the visual editor. Both feed
// the same `doc` state: a valid parse replaces the doc (the tree and preview
// update), an invalid parse is reported and NOT applied. While the textarea is
// focused it is the source of truth; when the doc changes from the visual side
// and the field is blurred, it resyncs — so the two editors never fight the
// caret. No Monaco: a textarea is enough to "edit the JSON alongside".

import * as React from "react";
import type { KageDoc } from "@/engine/types";
import { cn } from "@/lib/utils";

export function JsonEditor({ doc, onChange }: { doc: KageDoc; onChange: (doc: KageDoc) => void }) {
  const [text, setText] = React.useState(() => JSON.stringify(doc, null, 2));
  const [err, setErr] = React.useState<string | null>(null);
  const focused = React.useRef(false);

  // Resync from the doc only when the field isn't being typed into.
  React.useEffect(() => { if (!focused.current) { setText(JSON.stringify(doc, null, 2)); setErr(null); } }, [doc]);

  return (
    <div className="flex h-full flex-col gap-2">
      <textarea
        value={text} spellCheck={false}
        onFocus={() => (focused.current = true)}
        onBlur={() => { focused.current = false; setText(JSON.stringify(doc, null, 2)); setErr(null); }}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value) as KageDoc;
            if (!parsed || typeof parsed !== "object" || !parsed.blocks || !parsed.root) { setErr("not a Kage document (needs root + blocks)"); return; }
            setErr(null); onChange(parsed);
          } catch (x) { setErr((x as Error).message); }
        }}
        className={cn("min-h-0 flex-1 resize-none rounded-sm border bg-background p-3 font-mono text-[12px] leading-[17px] outline-none focus-visible:ring-1 focus-visible:ring-ring",
          err && "border-destructive focus-visible:ring-destructive")}
      />
      {err && <p className="shrink-0 text-xs text-destructive">Parse error: {err}</p>}
    </div>
  );
}
