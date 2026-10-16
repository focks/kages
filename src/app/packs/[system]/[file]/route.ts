// Public pack files: the pointers in llms.txt (`/packs/<system>/catalog.txt`, …) and
// the system card. Design data, not workspace data, so no auth and cacheable.
import { systems } from "@/engine/data";
import { pack } from "@/packs/packs";
import { generationSchema } from "@/engine/generate";

const FILES: Record<string, { type: string; get: (id: string) => string }> = {
  "SKILL.md": { type: "text/markdown", get: (id) => pack(id)["SKILL.md"] },
  "AGENTS.md": { type: "text/markdown", get: (id) => pack(id)["AGENTS.md"] },
  "SYSTEM.md": { type: "text/markdown", get: (id) => pack(id)["SYSTEM.md"] },
  "llms.txt": { type: "text/plain", get: (id) => pack(id)["llms.txt"] },
  "catalog.txt": { type: "text/plain", get: (id) => pack(id)["catalog.txt"] },
  "generation-schema.json": { type: "application/json", get: (id) => JSON.stringify(generationSchema(id), null, 2) },
};

export async function GET(_req: Request, { params }: { params: Promise<{ system: string; file: string }> }) {
  const { system, file } = await params;
  const f = Object.prototype.hasOwnProperty.call(FILES, file) ? FILES[file] : undefined;
  if (!f || !Object.prototype.hasOwnProperty.call(systems, system)) return new Response("not found", { status: 404 });
  return new Response(f.get(system), { headers: { "content-type": `${f.type}; charset=utf-8`, "cache-control": "public, max-age=300, s-maxage=3600" } });
}
