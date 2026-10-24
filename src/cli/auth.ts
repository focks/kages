// `kages auth` — sign in to a deployment from the terminal via the browser.
//
// Flow (OAuth 2.0 PKCE): ask the deployment for its public Supabase config
// (/api/config), open the browser to Supabase's Google sign-in with a redirect
// back to a short-lived local server, catch the code, exchange it for a session,
// and cache that session under ~/.kages. Thereafter `kages remote <op>` runs
// against your cloud workspace with the token (auto-refreshed when expired).

import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { readConfig, writeConfig, clearSession, type CliConfig, type Session } from "./config.ts";

const DEFAULT_API = process.env.KAGES_API ?? "https://app.getkages.com";
const CALLBACK_PORT = 52525;
const CALLBACK = `http://localhost:${CALLBACK_PORT}`;

const b64url = (b: Buffer) => b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { const child = spawn(cmd, args, { stdio: "ignore", detached: true }); child.on("error", () => {}); child.unref(); } catch { /* user can paste the URL */ }
}

interface PublicConfig { authEnabled: boolean; supabaseUrl: string | null; anonKey: string | null }

export async function login(apiUrl = DEFAULT_API): Promise<string> {
  const cfg = (await fetch(`${apiUrl}/api/config`).then((r) => r.json())) as PublicConfig;
  if (!cfg.authEnabled || !cfg.supabaseUrl || !cfg.anonKey) throw new Error(`${apiUrl} has authentication disabled`);

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash("sha256").update(verifier).digest());
  const authUrl = `${cfg.supabaseUrl}/auth/v1/authorize?provider=google` +
    `&redirect_to=${encodeURIComponent(CALLBACK)}` +
    `&code_challenge=${challenge}&code_challenge_method=s256`;

  const code = await new Promise<string>((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const server = http.createServer((req, res) => {
      const u = new URL(req.url ?? "/", CALLBACK);
      const c = u.searchParams.get("code");
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(`<!doctype html><meta charset="utf-8"><body style="font:16px system-ui;text-align:center;padding:4rem">${c ? "✓ Signed in to Kages — you can close this tab." : "No code received."}</body>`);
      if (c) { clearTimeout(timeout); server.close(); resolve(c); }
    });
    server.listen(CALLBACK_PORT, () => {
      process.stderr.write(`Opening the browser to sign in… (if it doesn't open, visit:\n${authUrl}\n)\n`);
      openBrowser(authUrl);
    });
    server.on("error", error => { clearTimeout(timeout); reject(error); });
    timeout = setTimeout(() => { server.close(); reject(new Error("timed out waiting for sign-in")); }, 180_000);
  });

  const tok = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=pkce`, {
    method: "POST",
    headers: { apikey: cfg.anonKey, "content-type": "application/json" },
    body: JSON.stringify({ auth_code: code, code_verifier: verifier }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error(`sign-in failed: ${tok.error_description || tok.msg || JSON.stringify(tok)}`);

  const session: Session = {
    access_token: tok.access_token,
    refresh_token: tok.refresh_token,
    expires_at: tok.expires_at ?? Math.floor(Date.now() / 1000) + (tok.expires_in ?? 3600),
    email: tok.user?.email ?? "",
  };
  writeConfig({ ...readConfig(), apiUrl, supabaseUrl: cfg.supabaseUrl, anonKey: cfg.anonKey, session });
  return session.email;
}

export function logout(): void { clearSession(); }

export function status(): { email: string; apiUrl: string } | null {
  const cfg = readConfig();
  return cfg.session ? { email: cfg.session.email, apiUrl: cfg.apiUrl ?? DEFAULT_API } : null;
}

/** A valid access token, refreshing it via the refresh token if expired. */
async function freshToken(cfg: CliConfig): Promise<string> {
  const s = cfg.session!;
  if (s.expires_at - 60 > Math.floor(Date.now() / 1000)) return s.access_token;
  const tok = await fetch(`${cfg.supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { apikey: cfg.anonKey!, "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  }).then((r) => r.json());
  if (!tok.access_token) throw new Error("session expired — run `kages auth login` again");
  const session: Session = { ...s, access_token: tok.access_token, refresh_token: tok.refresh_token ?? s.refresh_token, expires_at: tok.expires_at ?? Math.floor(Date.now() / 1000) + (tok.expires_in ?? 3600) };
  writeConfig({ ...cfg, session });
  return session.access_token;
}

/** Call an operation against the signed-in cloud deployment. */
export async function remoteCall(op: string, params: Record<string, unknown>): Promise<unknown> {
  const cfg = readConfig();
  if (!cfg.session) throw new Error("not signed in — run `kages auth login`");
  const token = await freshToken(cfg);
  const res = await fetch(`${cfg.apiUrl ?? DEFAULT_API}/api/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: { msg?: string } })?.error?.msg || res.statusText);
  return data;
}
