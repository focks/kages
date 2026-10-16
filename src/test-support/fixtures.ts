// Minimal valid documents reused across plans, so each test states only what it
// is about instead of re-deriving a valid Kage.
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import type { KageDoc } from "../engine/types.ts";

export function sampleKage(over: Partial<KageDoc> & { id?: string } = {}): KageDoc {
  const id = over.id ?? "sample";
  return {
    kages: "1.0", id, title: `Sample ${id}`, system: "core@1", root: "root",
    blocks: {
      root: { type: "page", props: {}, slots: { children: ["hello"] } },
      hello: { type: "text", props: { text: "Hello" } },
    },
    ...over,
  } as KageDoc;
}

/** Write `n` distinct sample Kages as `<id>.kage.json` files; returns their paths. */
export function seedWorkspace(dir: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const path = join(dir, `sample-${i + 1}.kage.json`);
    writeFileSync(path, JSON.stringify(sampleKage({ id: `sample-${i + 1}` }), null, 2));
    return path;
  });
}
