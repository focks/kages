// Default published viewers do not configure persistent storage. A document's
// requested persist scope must not masquerade as an active saving connection.
import type { KageDoc } from "@/engine/types";

export function DataSessionNotice({ doc }: { doc: KageDoc }) {
  const scopes = Object.values(doc.persist ?? {});
  if (!scopes.length && !doc.sources && !Object.values(doc.blocks).some(block => /(?:^|\/)csv-import(?:@|$)/.test(block.type))) return null;
  return <details className="px-4 py-2 text-xs text-muted-foreground">
    <summary className="cursor-pointer">Data and saving · session only</summary>
    <p className="mt-2">Changes and imported rows are not saved by this viewer. Copies and JSON downloads use the published starting values.</p>
    {!!scopes.length && <p className="mt-1">This Kage requests {scopes.includes("shared") ? "shared" : "personal"} storage, but persistent storage is not connected in this viewer.</p>}
  </details>;
}
