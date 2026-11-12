// Where an artifact export finds the design-system bundle: the app's own public/ds,
// the same place the server already reads its seed document from. A Kage version pins
// the build it was signed against (`resolved.assets`), and exporting it with a newer
// build would silently change what its blocks render, so the pinned folder is used and
// each file is checked against the pinned integrity. A build without those files (the
// single-file CLI) cannot export an artifact page, so say so instead of emitting one
// that would render blank.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtifactAssets } from "./artifact.ts";

const BASE = /^\/ds(\/versions\/[A-Za-z0-9_-]+)?$/;
export interface PinnedAssets { base?: string; integrity?: Record<string, string> }

export function loadArtifactAssets(root: string = process.cwd(), pinned?: PinnedAssets): ArtifactAssets {
  const base = pinned?.base ?? "/ds";
  if (!BASE.test(base)) throw new Error("this Kage pins an invalid design-system location");
  const read = (f: string) => {
    let text: string;
    try { text = readFileSync(join(root, "public", base, f), "utf8"); }
    catch { throw new Error(`artifact export needs the design-system build this Kage pinned (public${base}/${f}); run it from a Kages checkout or a deployment that serves it`); }
    const want = pinned?.integrity?.[f];
    // Integrity covers the bytes the browser would have fetched, so hash the file, not the decoded string.
    if (want && "sha384-" + createHash("sha384").update(readFileSync(join(root, "public", base, f))).digest("base64") !== want)
      throw new Error(`public${base}/${f} does not match the integrity this Kage pinned; refusing to export a page built from different bytes`);
    return text;
  };
  return { tokensCss: read("tokens.css"), bundleCss: read("bundle.css"), bundleJs: read("bundle.js") };
}
