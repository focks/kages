// The one place a public share link (/k/<uuid>) is turned into a document, so the JSON route and the
// markdown route cannot disagree about who may read what. Errors are a status plus the same body shape.
import type { KageDoc } from "../engine/types.ts";
import { getPublicShare, sharesEnabled } from "./public-shares.ts";
import { getStore } from "./store-instance.ts";

export type SharedDoc = { ok: true; doc: KageDoc } | { ok: false; status: number; code: string; msg: string };
const notFound: SharedDoc = { ok: false, status: 404, code: "not_found", msg: "no such shared Kage" };

export async function readSharedDoc(uuid: string): Promise<SharedDoc> {
  if (sharesEnabled()) {
    try {
      const doc = await getPublicShare(uuid);
      return doc ? { ok: true, doc } : notFound;
    } catch {
      return { ok: false, status: 503, code: "unavailable", msg: "share storage unavailable" };
    }
  }
  // Locally it falls back to the single "acme" store, gated to an anonymous principal so only
  // published link/public Kages resolve.
  const store = await getStore("acme");
  const name = store.nameByUuid(uuid);
  if (!name) return notFound;
  const r = store.authorizeRead(name, { principal: "anon" });
  return r.ok ? { ok: true, doc: r.record.doc } : { ok: false, status: 403, code: r.code, msg: r.msg };
}
