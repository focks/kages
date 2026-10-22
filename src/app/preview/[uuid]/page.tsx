"use client";

// The owner's full-page preview, opened in a new browser tab from the Library's
// Preview action. Unlike /k/<uuid> (the public share link, resolved as an
// anonymous reader so only published/link Kages load), this reads through the
// authenticated per-workspace `get_kage` operation, so a draft the signed-in
// owner can read previews too. No sidebar shell; the Kage paints in its own
// design system, exactly as a viewer would see it.

import { use, useEffect, useState } from "react";
import { KageRenderer } from "@/runtime/KageRenderer";
import { MadeWithKages } from "@/components/dashboard/made-with-kages";
import { op } from "@/components/dashboard/kage-ui";
import type { KageDoc } from "@/engine/types";

export default function PreviewPage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = use(params);
  const [doc, setDoc] = useState<KageDoc | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    op<KageDoc>("get_kage", { uuid })
      .then(setDoc)
      .catch((e) => setErr(String((e as Error).message || e)));
  }, [uuid]);

  if (err) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-lg font-[650]">This Kage isn’t available</h1>
          <p className="mt-1 text-sm text-muted-foreground">{err}</p>
        </div>
      </div>
    );
  }

  if (!doc) return <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-svh bg-background">
      <KageRenderer doc={doc} />
      <div className="pointer-events-none fixed inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto"><MadeWithKages /></div>
      </div>
    </div>
  );
}
