// Global registry of publicly shared Kages, so a /k/<uuid> link resolves WITHOUT
// knowing which user's workspace holds it. When a Kage is published to link/public
// its document is upserted here; when visibility narrows it's removed. The /k
// route reads this table directly (service key) — public reads never touch a
// per-user workspace store. Env-gated: with no Supabase, these are no-ops and the
// single local "acme" store serves /k via nameByUuid instead.
//
// Table: public_shares(uuid pk, doc jsonb, updated_at) — see supabase/migrations.

import type { KageDoc } from "../engine/types.ts";

const BASE = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TABLE = "public_shares";

export function sharesEnabled(): boolean {
  return !!(BASE && KEY);
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return { apikey: KEY!, Authorization: `Bearer ${KEY!}`, "Content-Type": "application/json", ...extra };
}

export async function getPublicShare(uuid: string): Promise<KageDoc | null> {
  if (!sharesEnabled()) return null;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?uuid=eq.${encodeURIComponent(uuid)}&select=doc`, { headers: headers() });
    if (!res.ok) { console.error(`getPublicShare: ${res.status} ${await res.text()}`); return null; }
    const rows = (await res.json()) as { doc: KageDoc }[];
    return rows[0]?.doc ?? null;
  } catch (e) { console.error("getPublicShare failed:", e); return null; }
}

export async function putPublicShare(uuid: string, doc: KageDoc): Promise<void> {
  if (!sharesEnabled()) return;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}`, {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates" }),
      body: JSON.stringify({ uuid, doc, updated_at: new Date().toISOString() }),
    });
    if (!res.ok) console.error(`putPublicShare: ${res.status} ${await res.text()}`);
  } catch (e) { console.error("putPublicShare failed:", e); }
}

export async function delPublicShare(uuid: string): Promise<void> {
  if (!sharesEnabled()) return;
  try {
    const res = await fetch(`${BASE}/rest/v1/${TABLE}?uuid=eq.${encodeURIComponent(uuid)}`, { method: "DELETE", headers: headers() });
    if (!res.ok) console.error(`delPublicShare: ${res.status} ${await res.text()}`);
  } catch (e) { console.error("delPublicShare failed:", e); }
}
