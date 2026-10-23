// References are selected from generated pack keys, never filesystem paths.
// This keeps the browser-readable skill's relative links usable without letting
// a requested path read arbitrary source files.
import { systems } from "@/engine/data";
import { skillFiles } from "@/packs/packs";

export async function GET(_req: Request, { params }: { params: Promise<{ system: string; file: string[] }> }) {
  const { system, file } = await params;
  if (!Object.hasOwn(systems, system)) return new Response("not found", { status: 404 });
  const files = skillFiles(system), path = "reference/" + file.join("/");
  if (!Object.hasOwn(files, path)) return new Response("not found", { status: 404 });
  return new Response(files[path], { headers: { "content-type": `${path.endsWith(".json") ? "application/json" : "text/markdown"}; charset=utf-8`, "cache-control": "public, max-age=300, s-maxage=3600" } });
}
