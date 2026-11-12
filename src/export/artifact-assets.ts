// Where an artifact export finds the design-system bundle: the app's own public/ds,
// the same place the server already reads its seed document from. A build without
// those files (the single-file CLI) cannot export an artifact page, so say so
// instead of emitting a page that would render blank.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ArtifactAssets } from "./artifact.ts";

export function loadArtifactAssets(root: string = process.cwd()): ArtifactAssets {
  const read = (f: string) => {
    try { return readFileSync(join(root, "public/ds", f), "utf8"); }
    catch { throw new Error(`artifact export needs the design-system bundle (public/ds/${f}); run it from a Kages checkout or a deployment that serves it`); }
  };
  return { tokensCss: read("tokens.css"), bundleCss: read("bundle.css"), bundleJs: read("bundle.js") };
}
