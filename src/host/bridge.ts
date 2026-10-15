// The host bridge: the ONLY path from a Kage to the outside world. The runtime
// itself never touches the network — every side effect goes through one bridge
// with explicit, gated capabilities, following the capability model of Claude
// artifacts but provider-neutral. The gates here are security boundaries, not
// conveniences: shared storage warns before input, `ask` bills the configured
// payer and asks first-use permission, connectors need approval, fetch is
// allowlisted to declared sources, and in-Kage actions NEVER run with the
// authoring agent's credentials — they run with the viewer's or workspace's.
// See oracle/runtime-security.feature.

import type { KageDoc, Json } from "../engine/types.ts";

export type Billing = "viewer" | "workspace" | "owner";

export interface BridgeConfig {
  /** Who pays for `ask` model calls in this workspace. */
  billing?: Billing;
  /** Agent ids registered in the workspace; only these can be invoked. */
  registeredAgents?: string[];
  /** Connectors the viewer has approved. */
  approvedConnectors?: string[];
  /** Host-side URL allowlist for proxy.fetch (prefix match). */
  fetchAllowlist?: string[];
  /** The network primitive behind `load`. Absent → the platform `fetch`; tests
   *  and hosts inject their own so the bridge never reaches the network by
   *  accident. Must honour `signal`. */
  fetcher?: (url: string, init: { method: "GET"; credentials: "omit"; redirect: "error"; headers: Record<string, string>; signal: AbortSignal }) => Promise<{ ok: boolean; status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;
  /** Wall-clock limit for one load, ms. */
  fetchTimeoutMs?: number;
  /** Largest accepted response body, bytes. */
  fetchMaxBytes?: number;
  /** Max emit() calls before rate-limiting. */
  emitLimit?: number;
  /** A model gateway. Absent → a deterministic stub, so previews/tests work
   *  without a real provider. Provider-neutral: any model sits behind this. */
  model?: (req: { prompt: string; model?: string; schema?: Json }) => Promise<string>;
  /** Grants a registered agent runs with (NOT the Kage author's). */
  agent?: (agentId: string, input: Json) => Promise<Json>;
  /** Viewer profile, if offered. Name and avatar only. */
  viewer?: { name: string; avatar?: string };
}

export interface CapResult<T = Json> {
  ok: boolean;
  value?: T;
  notice?: string;
  error?: { code: string; msg: string };
}

/** Literal-address check only: DNS names are resolved by the browser, so this
 *  stops the obvious localhost / RFC1918 / link-local targets, not rebinding.
 *  Hosts that proxy requests server-side must add their own egress policy. */
function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;
  if (h.includes(":")) return h === "::1" || h === "::" || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || /^::ffff:/.test(h);
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(h);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}

/** Walk own keys of a dotted path ("data.items"); a miss yields null, never a throw. */
function pick(value: Json, path?: string): Json {
  if (!path) return value;
  let cur: unknown = value;
  for (const key of path.split(".").slice(0, 16)) {
    if (cur === null || typeof cur !== "object" || !Object.prototype.hasOwnProperty.call(cur, key)) return null;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur as Json;
}

/** Cap every array (recursively, to a fixed depth) so an oversized response
 *  cannot become an oversized state tree. */
function bound(value: Json, max: number, depth = 0): Json {
  if (depth > 12 || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.slice(0, max).map((v) => bound(v, max, depth + 1));
  const out: Record<string, Json> = {};
  for (const [k, v] of Object.entries(value)) out[k] = bound(v as Json, max, depth + 1);
  return out;
}

const deny = <T = Json>(code: string, msg: string): CapResult<T> => ({ ok: false, error: { code, msg } });

export class HostBridge {
  private personal = new Map<string, Json>();
  private shared = new Map<string, Json>();
  private askPermitted = false;
  private emitCount = 0;
  // Explicit fields (no parameter-property shorthand): native type-stripping
  // under `node --test` can't emit the implied assignment. See testing-conventions.
  private doc: KageDoc;
  private cfg: BridgeConfig;

  constructor(doc: KageDoc, cfg: BridgeConfig = {}) {
    this.doc = doc;
    this.cfg = cfg;
  }

  // --- storage: personal (per viewer) | shared (all viewers) -----------------

  /** Read/write is allowed ONLY for keys declared in the Kage's `persist` map,
   *  in the matching scope. A key with no persist entry is never stored — it
   *  resets on reload by design, so transient UI state can't leak to disk. */
  private scopeOf(key: string): "personal" | "shared" | null {
    return this.doc.persist?.[key] ?? null;
  }

  storageGet(key: string): CapResult {
    const scope = this.scopeOf(key);
    if (!scope) return deny("not_persisted", `'${key}' is not a persist key`);
    const store = scope === "shared" ? this.shared : this.personal;
    return { ok: true, value: store.has(key) ? store.get(key)! : null };
  }

  storageSet(key: string, value: Json): CapResult {
    const scope = this.scopeOf(key);
    if (!scope) return deny("not_persisted", `'${key}' is not a persist key`);
    (scope === "shared" ? this.shared : this.personal).set(key, value);
    // Shared storage is visible to every viewer — surface a notice the UI shows
    // before the write is committed to anything sensitive.
    return { ok: true, notice: scope === "shared" ? "Shared storage is visible to everyone with access to this Kage." : undefined };
  }

  // --- models: the `ask` gateway, provider-neutral, billed, permissioned ------

  async ask(prompt: string, opts: { model?: string; schema?: Json } = {}): Promise<CapResult<string>> {
    if (!this.askPermitted) {
      // First use asks the viewer; a caller grants it via permitAsk() after the
      // user agrees. Until then the call is refused, never silently billed.
      return deny("permission_required", "First model use needs the viewer's permission");
    }
    const gateway = this.cfg.model ?? (async (r) => `[stub ${r.model ?? "fast"}] ${r.prompt.slice(0, 60)}`);
    const text = await gateway({ prompt, model: opts.model, schema: opts.schema });
    return { ok: true, value: text, notice: `billed to: ${this.cfg.billing ?? "viewer"}` };
  }

  /** Record that the viewer approved model use (first-use permission). */
  permitAsk(): void { this.askPermitted = true; }

  // --- agents: only registered, with their OWN grants ------------------------

  async invokeAgent(agentId: string, input: Json): Promise<CapResult> {
    if (!(this.cfg.registeredAgents ?? []).includes(agentId)) return deny("not_registered", `agent '${agentId}' is not registered in this workspace`);
    const run = this.cfg.agent ?? (async () => null);
    return { ok: true, value: await run(agentId, input) };
  }

  // --- connectors: per-connector viewer approval ------------------------------

  connectorCall(name: string): CapResult {
    if (!(this.cfg.approvedConnectors ?? []).includes(name)) return deny("not_approved", `connector '${name}' needs viewer approval`);
    // Tools that need per-action approval are refused to artifacts entirely.
    return { ok: true, value: null };
  }

  // --- fetch: only declared sources, host-side allowlist ----------------------

  fetch(sourceKey: string): CapResult {
    const source = this.doc.sources?.[sourceKey] as { url?: string } | undefined;
    if (!source) return deny("unknown_source", `'${sourceKey}' is not in sources`);
    const url = source.url;
    if (url && !(this.cfg.fetchAllowlist ?? []).some((prefix) => url.startsWith(prefix))) return deny("not_allowlisted", `'${url}' is not on the host allowlist`);
    return { ok: true, value: null };
  }

  /** Really fetch a declared source. Goes through the same gates as `fetch`
   *  (declared + allowlisted), then adds the network hardening that makes a
   *  Kage-chosen URL safe to request: https only, no literal private or
   *  loopback hosts, no credentials or redirects, a time and size cap, and a
   *  JSON-only body. Returned data is untrusted: prototype-polluting keys are
   *  dropped, an optional dotted `path` selects a sub-tree and `maxItems`
   *  bounds arrays so a huge response cannot flood state. Never throws. */
  async load(sourceKey: string): Promise<CapResult> {
    const gate = this.fetch(sourceKey);
    if (!gate.ok) return gate;
    const source = this.doc.sources![sourceKey] as { url?: string; path?: string; maxItems?: number };
    let url: URL;
    try { url = new URL(String(source.url)); } catch { return deny("bad_url", "source url is not a valid URL"); }
    if (url.protocol !== "https:") return deny("insecure_url", "only https sources can be loaded");
    if (url.username || url.password) return deny("bad_url", "source url must not embed credentials");
    if (isPrivateHost(url.hostname)) return deny("private_host", "private and loopback hosts cannot be loaded");
    const fetcher = this.cfg.fetcher ?? (globalThis.fetch as unknown as NonNullable<BridgeConfig["fetcher"]> | undefined);
    if (!fetcher) return deny("no_network", "this host provides no network access");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.cfg.fetchTimeoutMs ?? 5000);
    try {
      const res = await fetcher(url.toString(), { method: "GET", credentials: "omit", redirect: "error", headers: { accept: "application/json" }, signal: controller.signal });
      if (!res.ok) return deny("http_error", "source answered " + res.status);
      if (!/\bjson\b/i.test(res.headers.get("content-type") ?? "")) return deny("not_json", "source did not answer with JSON");
      const text = await res.text();
      if (text.length > (this.cfg.fetchMaxBytes ?? 1_000_000)) return deny("too_large", "response exceeds the size limit");
      // The reviver drops keys that would reach Object.prototype when a Kage
      // later writes this value into state paths.
      const parsed = JSON.parse(text, (k, v) => (k === "__proto__" || k === "constructor" || k === "prototype" ? undefined : v)) as Json;
      return { ok: true, value: bound(pick(parsed, source.path), Math.max(1, Math.min(10_000, Math.floor(source.maxItems ?? 1000)))) };
    } catch (e) {
      return deny((e as Error).name === "AbortError" ? "timeout" : "load_failed", "the source could not be loaded");
    } finally { clearTimeout(timer); }
  }

  // --- viewer profile: name + avatar only -------------------------------------

  viewerProfile(): CapResult {
    if (!this.cfg.viewer) return deny("not_offered", "viewer profile not offered");
    return { ok: true, value: { name: this.cfg.viewer.name, avatar: this.cfg.viewer.avatar ?? null } };
  }

  // --- emit: rate-limited host event ------------------------------------------

  emit(name: string, payload: Json): CapResult {
    const limit = this.cfg.emitLimit ?? 100;
    if (this.emitCount >= limit) return deny("rate_limited", `emit limit ${limit} reached`);
    this.emitCount++;
    return { ok: true, value: { name, payload } };
  }
}
