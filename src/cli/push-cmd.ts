// `kages push`: the bridge from the local CLI store to a running Kages app. The CLI writes
// ./.kages/store.json and the app keeps its own store, so a Kage made on the command line is
// invisible in the Library until something carries it across. This carries it over the same
// REST operations the app uses (create_kage, or patch_kage with --replace), and prints the
// link to open. It never deletes: a Kage that already exists on the server is left alone
// unless --replace, which turns the difference into top-level patch ops so history is kept.
import type { KageDoc } from "../engine/types.ts";
import { out } from "./format.ts";

export type Call = (op: string, params: Record<string, unknown>) => Promise<{ ok: true; data: any } | { ok: false; code: string; msg: string }>;

const canon = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Top-level patch ops that make the server's copy say exactly what `local` says: fields are added,
 *  replaced, and REMOVED when the local Kage no longer has them (a dropped `brief` must not linger on
 *  the server while the command claims it is up to date). `id`, the format marker and `resolved`
 *  (the one key a store stamps itself) are never touched; comparison ignores key order, which the
 *  server does not preserve. */
export function replaceOps(remote: Record<string, unknown>, local: Record<string, unknown>): { op: string; path: string; value?: unknown }[] {
  const ops: { op: string; path: string; value?: unknown }[] = [];
  for (const k of Object.keys(local)) {
    if (k === "id" || k === "kages" || k === "resolved") continue;
    if (!(k in remote)) ops.push({ op: "add", path: `/${k}`, value: local[k] });
    else if (canon(remote[k]) !== canon(local[k])) ops.push({ op: "replace", path: `/${k}`, value: local[k] });
  }
  for (const k of Object.keys(remote)) {
    if (k === "id" || k === "kages" || k === "resolved") continue;
    if (!(k in local)) ops.push({ op: "remove", path: `/${k}` });
  }
  return ops;
}

export function httpCall(server: string, token?: string, fetchImpl: typeof fetch = fetch): Call {
  return async (op, params) => {
    let res: Response;
    try {
      res = await fetchImpl(`${server.replace(/\/$/, "")}/api/${op}`, { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(params) });
    } catch (e) { return { ok: false, code: "unreachable", msg: `could not reach ${server} (${(e as Error).message}); is the app running? Try: npm run dev` }; }
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { ok: true, data: body };
    const err = (body as { error?: { code?: string; msg?: string } }).error;
    return { ok: false, code: err?.code ?? String(res.status), msg: err?.msg ?? res.statusText };
  };
}

export async function push(doc: KageDoc, server: string, call: Call, o: { replace?: boolean; publish?: boolean; visibility?: string } = {}): Promise<{ exit: number; lines: string[] }> {
  const name = doc.id, link = `${server.replace(/\/$/, "")}/artifacts?id=${encodeURIComponent(name)}`;
  const existing = await call("get_kage", { name });
  if (!existing.ok && existing.code === "unreachable") return { exit: 1, lines: [existing.msg] };
  let verb: string;
  if (existing.ok) {
    if (!o.replace) return { exit: 1, lines: [`'${name}' already exists on ${server}. Re-run with --replace to update it (history is kept), or rename the Kage's id.`] };
    const ops = replaceOps((existing.data.doc ?? existing.data) as Record<string, unknown>, doc as unknown as Record<string, unknown>);
    if (ops.length) {
      const r = await call("patch_kage", { name, ops });
      if (!r.ok) return { exit: 1, lines: [`${r.code}: ${r.msg}`] };
      verb = "updated";
    } else verb = "unchanged";
  } else {
    const r = await call("create_kage", { doc });
    if (!r.ok) return { exit: 1, lines: [`${r.code}: ${r.msg}`] };
    verb = "created";
  }
  const lines = [verb === "unchanged" ? `'${name}' is already up to date on ${server}` : `${verb} '${name}' on ${server}`];
  let exit = 0;
  // Publishing is its own request, so it runs whether or not the document changed: an unchanged draft
  // pushed with --publish must still become shareable.
  if (o.publish) {
    const vis = o.visibility ?? "link";
    const p = await call("publish_kage", { name, visibility: vis });
    if (p.ok) lines.push(`published (${vis}: anyone with the link can open it and leave feedback)`);
    else if (p.code === "bad_state" && /published -> published/.test(p.msg)) {
      // Already published. With no explicit visibility that is the desired state; with one, apply it.
      if (!o.visibility) lines.push("already published");
      else {
        const sh = await call("share_kage", { name, visibility: vis });
        if (sh.ok) lines.push(`already published; visibility is now ${vis}`);
        else { lines.push(`already published, but visibility was not changed to ${vis}: ${sh.code}: ${sh.msg}`); exit = 1; }
      }
    } else { lines.push(`not published: ${p.code}: ${p.msg}`); exit = 1; }
  }
  lines.push(link);
  return { exit, lines };
}

export function pushCmd(lines: { exit: number; lines: string[] }): number { for (const l of lines.lines) out(l); return lines.exit; }
