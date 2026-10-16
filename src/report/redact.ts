// Redaction is the whole safety story of `kages report`, so it is a pure function with a corpus
// of tests, applied twice: the bundle is assembled from typed fields that carry no free text
// (allow-list first) and the finished markdown is redacted again as a whole (defence in depth).
// A false negative is the real danger, so the patterns lean toward over-redacting, but ids a
// maintainer needs (commit SHAs, block ids, versions, rule ids) must survive; the corpus pins both.

export type RedactClass = "jwt" | "bearer" | "auth-header" | "db-url" | "url-credentials" | "api-key" | "secret-assignment" | "email" | "home-path" | "private-ip";
export interface Redacted { text: string; counts: Partial<Record<RedactClass, number>> }

// Order matters: the whole-URL and header patterns run before the narrower ones so a token inside
// them is not left half-redacted.
const RULES: { cls: RedactClass; re: RegExp; to: string | ((m: string, ...g: string[]) => string) }[] = [
  { cls: "auth-header", re: /\b(authorization|proxy-authorization|x-api-key|apikey|cookie|set-cookie)\s*:\s*[^\r\n]+/gi, to: (_m, h) => `${h}: <redacted>` },
  { cls: "db-url", re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|amqps?):\/\/[^\s"'`<>)]+/gi, to: "<db-url>" },
  { cls: "url-credentials", re: /\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:"'`]+:[^\s/@"'`]+@/gi, to: (_m, scheme) => `${scheme}<credentials>@` },
  { cls: "jwt", re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, to: "<jwt>" },
  { cls: "bearer", re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, to: "Bearer <redacted>" },
  { cls: "api-key", re: /\b(?:sk-(?:ant-|proj-|live-|test-)?[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{30,}|sbp_[a-f0-9]{30,}|sb_(?:secret|publishable)_[A-Za-z0-9_-]{16,}|npm_[A-Za-z0-9]{30,})\b/g, to: "<api-key>" },
  { cls: "secret-assignment", re: /\b((?:[A-Za-z0-9_-]*?)(?:token|secret|passw(?:or)?d|passwd|api[_-]?key|anon[_-]?key|session|private[_-]?key)[A-Za-z0-9_-]*)(["']?\s*[:=]\s*["']?)([^\s"',;}]{4,})/gi, to: (_m, name, sep) => `${name}${sep}<redacted>` },
  { cls: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g, to: "<email>" },
  { cls: "home-path", re: /(?:\/home\/[^/\s"'`:]+|\/Users\/[^/\s"'`:]+|[A-Za-z]:\\Users\\[^\\\s"'`:]+)/g, to: "~" },
  { cls: "private-ip", re: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/g, to: "<private-ip>" },
];

/** Redact, reporting how much of each class was removed. `home` (the real home directory) is replaced even when it is not under /home. */
export function redactDetailed(text: string, opts: { home?: string; extra?: string[] } = {}): Redacted {
  const counts: Redacted["counts"] = {};
  let out = text;
  const bump = (c: RedactClass) => { counts[c] = (counts[c] ?? 0) + 1; };
  for (const v of opts.extra ?? []) if (v.length >= 6) out = out.split(v).join("<redacted>");
  if (opts.home && opts.home.length > 1 && opts.home !== "/") { const n = out.split(opts.home).length - 1; if (n) { counts["home-path"] = (counts["home-path"] ?? 0) + n; out = out.split(opts.home).join("~"); } }
  for (const r of RULES) out = out.replace(r.re, (...args) => { bump(r.cls); return typeof r.to === "string" ? r.to : r.to(args[0] as string, ...(args.slice(1, -2) as string[])); });
  return { text: out, counts };
}

export const redact = (text: string, opts: { home?: string; extra?: string[] } = {}): string => redactDetailed(text, opts).text;

/** A config or env key whose value must never be shown, whatever `--include-config-values` says. */
export const isSecretName = (name: string): boolean => /(token|secret|passw|api[_-]?key|anon[_-]?key|session|private[_-]?key|credential|database_?url|connection)/i.test(name);
