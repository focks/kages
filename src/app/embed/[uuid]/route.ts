// Revoking publication revokes the embed on its next read. Policy comes only
// from the published document, never a query parameter supplied by its embedder.
import { randomUUID } from "node:crypto";
import { readSharedDoc } from "@/server/shared-doc";
import { publishedEmbedOrigins } from "@/store/embed-policy";
import { embedHtml } from "@/server/embed-html";

export async function GET(request: Request, { params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const shared = await readSharedDoc(uuid);
  const denied = { "Content-Security-Policy": "frame-ancestors 'none'", "Cache-Control": "no-store" };
  if (!shared.ok) return new Response("This shared Kage is unavailable.", { status: shared.status, headers: denied });
  const origins = publishedEmbedOrigins(shared.doc.meta);
  if (!origins.length) return new Response("The owner has not enabled embedding for this Kage.", { status: 403, headers: denied });
  try {
    const result = embedHtml(shared.doc, uuid, new URL(request.url).origin, origins, randomUUID());
    return new Response(result.html, { headers: { "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": result.csp, "Cache-Control": "no-store" } });
  } catch {
    return new Response("The artifact's pinned runtime is unavailable.", { status: 503, headers: denied });
  }
}
