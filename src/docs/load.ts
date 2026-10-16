// Read docs/ from disk and build it. Server-side only (the route and the build gates).
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { buildDocs, type DocsBuild, type DocsConfig } from "./build.ts";

export function loadDocs(dir = join(process.cwd(), "docs")): DocsBuild & { config: DocsConfig } {
  const config = JSON.parse(readFileSync(join(dir, "docs.config.json"), "utf8")) as DocsConfig;
  const sources: Record<string, string> = {};
  for (const f of readdirSync(dir)) if (f.endsWith(".md")) sources[f] = readFileSync(join(dir, f), "utf8");
  return { ...buildDocs(sources, config), config };
}
