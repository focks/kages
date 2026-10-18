// The visual review loop: render a Kage in headless Chrome and hand back a PNG
// plus objective checks, so an agent (or person) can see its own work instead of
// guessing. Chrome is driven over the DevTools protocol with Node's built-in
// WebSocket — no browser automation dependency — against the app's public
// /render page, which paints exactly the document it is given.
//
// Needs two things from the machine: a Chrome/Chromium binary, and a running
// Kages app to serve the design system (`npm run dev`). Both absences produce an
// error that says how to fix them, never a hang. See oracle/screenshot.feature.

import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve as resolvePath } from "node:path";
import type { KageDoc } from "../engine/types.ts";

export interface ShotOptions {
  /** Base URL of a running Kages app. Default: KAGES_URL, else probe local dev ports. */
  url?: string;
  widths: number[];
  height: number;
  dark: boolean;
  scale: number;
  system?: string;
  /** Pages taller than this are cut and flagged, so a runaway layout cannot make a gigantic image. */
  maxHeight: number;
  noSandbox: boolean;
  chrome?: string;
}

export interface PageMetrics {
  innerWidth: number; scrollWidth: number; scrollHeight: number; blocks: number;
  missing: string[]; brokenImages: string[]; overflowing: string[];
  /** SVG text drawn smaller than MIN_TEXT_PX once the figure is scaled to fit, as "@block 5.7px". */
  tinyText: string[];
}

/** Below this, text in a chart or diagram stops being legible on a phone. */
export const MIN_TEXT_PX = 8;
export interface ShotResult {
  width: number; height: number; png: Buffer; truncated: boolean;
  metrics: PageMetrics; consoleErrors: string[]; issues: string[];
}

export const DEFAULTS: Omit<ShotOptions, "widths"> & { widths: number[] } = { widths: [1200], height: 900, dark: false, scale: 1, maxHeight: 12000, noSandbox: false };

/** "390,1200" → [390, 1200]; rejects nonsense and caps the count and size so one
 *  typo cannot ask for a 100000px viewport or fifty renders. */
export function parseWidths(input: unknown): number[] {
  const parts = String(input ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return DEFAULTS.widths;
  const widths = parts.map(Number);
  if (widths.some((w) => !Number.isInteger(w) || w < 240 || w > 3840)) throw new Error("--width takes whole numbers between 240 and 3840, comma-separated (e.g. 390,1200)");
  if (new Set(widths).size !== widths.length || widths.length > 6) throw new Error("--width takes up to 6 different widths");
  return widths;
}

/** The first Chrome-like binary that exists. `exists` is injectable so this is testable. */
export function findChrome(env: Record<string, string | undefined> = process.env, exists: (p: string) => boolean = existsSync): string | undefined {
  const named = env.KAGES_CHROME ?? env.CHROME_PATH;
  if (named) return exists(named) ? named : undefined;
  const dirs = (env.PATH ?? "").split(process.platform === "win32" ? ";" : ":").filter(Boolean);
  const bins = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser", "chrome", "microsoft-edge"];
  for (const d of dirs) for (const b of bins) if (exists(join(d, b))) return join(d, b);
  const fixed = ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "/Applications/Chromium.app/Contents/MacOS/Chromium", "/usr/bin/google-chrome", "/usr/bin/chromium", "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"];
  return fixed.find(exists);
}

/** Turn raw measurements into the findings a reviewer would act on. Pure. */
export function summarize(m: PageMetrics, consoleErrors: string[], truncated: boolean, maxHeight: number): string[] {
  const issues: string[] = [];
  for (const t of m.missing.slice(0, 5)) issues.push(`a block failed to render: ${t}`);
  if (m.scrollWidth > m.innerWidth + 1) issues.push(`the page scrolls sideways (${m.scrollWidth}px wide in a ${m.innerWidth}px viewport)${m.overflowing.length ? "; overflowing: " + m.overflowing.slice(0, 4).join(", ") : ""}`);
  for (const s of m.brokenImages.slice(0, 5)) issues.push(`an image did not load: ${s}`);
  for (const e of consoleErrors.slice(0, 5)) issues.push(`console error: ${e}`);
  if (truncated) issues.push(`the page is taller than ${maxHeight}px; the screenshot stops there`);
  if (m.tinyText.length) issues.push(`text is too small to read in ${m.tinyText.slice(0, 4).join(", ")} (under ${MIN_TEXT_PX}px after scaling to fit); the figure needs a larger minimum size or fewer labels`);
  if (m.blocks === 0) issues.push("no blocks were rendered (an empty page)");
  return issues;
}

// --- a minimal DevTools client ------------------------------------------------

class Cdp {
  private ws: WebSocket;
  private id = 0;
  private pending = new Map<number, { resolve: (v: any) => void; reject: (e: Error) => void }>();
  private listeners: ((method: string, params: any) => void)[] = [];
  private constructor(ws: WebSocket) {
    this.ws = ws;
    ws.addEventListener("message", (e) => {
      const m = JSON.parse(String(e.data));
      if (m.id !== undefined) { const p = this.pending.get(m.id); this.pending.delete(m.id); if (p) m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); }
      else for (const l of this.listeners) l(m.method, m.params);
    });
    ws.addEventListener("close", () => { for (const p of this.pending.values()) p.reject(new Error("the browser closed the connection")); this.pending.clear(); });
  }
  static async connect(url: string): Promise<Cdp> {
    if (typeof WebSocket === "undefined") throw new Error("screenshots need Node 22 or newer (built-in WebSocket)");
    const ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => { ws.addEventListener("open", () => resolve(), { once: true }); ws.addEventListener("error", () => reject(new Error("could not connect to the browser")), { once: true }); });
    return new Cdp(ws);
  }
  send<T = any>(method: string, params: object = {}): Promise<T> {
    return new Promise((resolve, reject) => { const id = ++this.id; this.pending.set(id, { resolve, reject }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(l: (method: string, params: any) => void) { this.listeners.push(l); }
  close() { try { this.ws.close(); } catch { /* already closed */ } }
}

async function reachable(base: string): Promise<boolean> {
  try { const r = await fetch(base.replace(/\/$/, "") + "/render", { signal: AbortSignal.timeout(4000) }); return r.ok; } catch { return false; }
}

/** The app to render against: the flag, KAGES_URL, or the usual local dev ports. */
export async function resolveBase(url: string | undefined, env: Record<string, string | undefined> = process.env): Promise<string> {
  const explicit = url ?? env.KAGES_URL;
  const candidates = explicit ? [explicit] : ["http://localhost:3000", "http://localhost:3100", "http://localhost:3001"];
  for (const c of candidates) if (await reachable(c)) return c.replace(/\/$/, "");
  throw new Error(explicit
    ? `no Kages app answered at ${explicit}/render — is it running? (start it with \`npm run dev\`)`
    : "no running Kages app found on localhost:3000/3100/3001 — start one with `npm run dev`, or pass --url / set KAGES_URL");
}

export async function launch(chrome: string, noSandbox: boolean, timeoutMs = 15_000): Promise<{ wsUrl: string; port: number; stop: () => void }> {
  const profile = mkdtempSync(join(tmpdir(), "kages-shot-"));
  const args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--remote-debugging-port=0", "--user-data-dir=" + profile, ...(noSandbox ? ["--no-sandbox"] : []), "about:blank"];
  const child = spawn(chrome, args, { stdio: ["ignore", "ignore", "pipe"] });
  // The caller only gets `stop` after launch resolves, and calls launch before its
  // try/finally. So every failure path here must release the child and the profile
  // itself, or each retry leaks a headless Chrome and a temp dir.
  const stop = () => { child.kill("SIGKILL"); try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ } };
  let stderr = "";
  let ws: string;
  try {
    ws = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Chrome did not start within ${Math.round(timeoutMs / 1000)} seconds`)), timeoutMs);
      child.stderr!.on("data", (d: Buffer) => { stderr += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(stderr); if (m) { clearTimeout(timer); resolve(m[1]); } });
      child.on("error", (e) => { clearTimeout(timer); reject(new Error(`could not run Chrome (${chrome}): ${e.message}`)); });
      child.on("exit", (code) => { clearTimeout(timer); reject(new Error(`Chrome exited early (code ${code})${/sandbox|namespace/i.test(stderr) ? " — it refused to start its sandbox; try --no-sandbox" : ""}`)); });
    });
  } catch (e) { stop(); throw e; }
  const port = Number(new URL(ws).port);
  return { wsUrl: ws, port, stop };
}

const MEASURE = "window.__kages.metrics || {innerWidth:innerWidth,scrollWidth:innerWidth,scrollHeight:document.body.scrollHeight,blocks:0,missing:[],brokenImages:[],overflowing:[],tinyText:[]}";

/** Render one document at each requested width. One browser, one page per width. */
export async function screenshotDoc(doc: KageDoc, opts: ShotOptions): Promise<ShotResult[]> {
  const chrome = opts.chrome ?? findChrome();
  if (!chrome) throw new Error("no Chrome or Chromium found — install one, or set KAGES_CHROME to its path");
  const base = await resolveBase(opts.url);
  const browser = await launch(chrome, opts.noSandbox);
  const results: ShotResult[] = [];
  try {
    for (const width of opts.widths) {
      const res = await fetch(`http://127.0.0.1:${browser.port}/json/new?about:blank`, { method: "PUT" });
      const target = (await res.json()) as { webSocketDebuggerUrl: string; id: string };
      const cdp = await Cdp.connect(target.webSocketDebuggerUrl);
      const errors: string[] = [];
      cdp.on((method, p) => {
        if (method === "Runtime.exceptionThrown") errors.push(String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).split("\n")[0].slice(0, 200));
        else if (method === "Runtime.consoleAPICalled" && p.type === "error") errors.push(p.args.map((a: { value?: unknown; description?: string }) => a.value ?? a.description ?? "").join(" ").slice(0, 200));
        else if (method === "Log.entryAdded" && p.entry.level === "error" && !/favicon/.test(p.entry.url ?? "")) errors.push(`${p.entry.text} ${p.entry.url ?? ""}`.trim().slice(0, 200));
      });
      await cdp.send("Runtime.enable"); await cdp.send("Log.enable"); await cdp.send("Page.enable");
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height: opts.height, deviceScaleFactor: opts.scale, mobile: width < 500 });
      await cdp.send("Page.navigate", { url: base + "/render" });
      // Wait for the page to expose its hook, then hand it the document.
      const until = Date.now() + 20_000;
      for (;;) {
        const r = await cdp.send("Runtime.evaluate", { expression: "!!(window.__kages && window.__kages.ready)", returnByValue: true });
        if (r.result.value) break;
        if (Date.now() > until) throw new Error("the render page never became ready (is this a Kages app?)");
        await new Promise((r2) => setTimeout(r2, 100));
      }
      const call = await cdp.send("Runtime.evaluate", { expression: `window.__kages.render(${JSON.stringify(doc)}, ${JSON.stringify({ system: opts.system, dark: opts.dark })})`, awaitPromise: true, returnByValue: true });
      if (call.exceptionDetails) throw new Error("rendering failed: " + String(call.exceptionDetails.exception?.description ?? call.exceptionDetails.text).split("\n")[0]);
      if (call.result.value && call.result.value.ok === false) errors.unshift(String(call.result.value.reason));
      // The dev server paints a floating indicator that is not part of the page.
      await cdp.send("Runtime.evaluate", { expression: "document.querySelectorAll('nextjs-portal').forEach((e) => e.remove())" });
      let metrics = (await cdp.send("Runtime.evaluate", { expression: MEASURE, returnByValue: true })).result.value as PageMetrics;
      await new Promise((r) => setTimeout(r, 300)); // measure again after a beat; keep the taller page
      const again = (await cdp.send("Runtime.evaluate", { expression: MEASURE, returnByValue: true })).result.value as PageMetrics;
      metrics = { ...again, scrollHeight: Math.max(metrics.scrollHeight, again.scrollHeight) };
      const full = Math.max(opts.height, metrics.scrollHeight), height = Math.min(full, opts.maxHeight), truncated = full > opts.maxHeight;
      // The artifact lives in a sandboxed (cross-process) iframe, and Chrome does not paint such a frame beyond
      // the viewport that was set when it loaded: `captureBeyondViewport` then returns the page blank below the
      // fold. Grow the viewport to the whole page, let the frame repaint, and capture what is on screen.
      await cdp.send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: opts.scale, mobile: width < 500 });
      await cdp.send("Runtime.evaluate", { expression: "new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 250))))", awaitPromise: true });
      const shot = await cdp.send("Page.captureScreenshot", { format: "png", clip: { x: 0, y: 0, width, height, scale: 1 } });
      results.push({ width, height, png: Buffer.from(shot.data, "base64"), truncated, metrics, consoleErrors: errors, issues: summarize(metrics, errors, truncated, opts.maxHeight) });
      cdp.close();
      await fetch(`http://127.0.0.1:${browser.port}/json/close/${target.id}`).catch(() => {});
    }
  } finally { browser.stop(); }
  return results;
}

/** Where each width's PNG goes. `-o name.png` names one file, so it cannot hold several widths (it used
 *  to be ignored and the files landed in the current directory). The document id comes from the input
 *  file, so it is reduced to a plain filename: an id like `../../x` must not write outside `-o`. */
export function shotFiles(target: string | undefined, widths: number[], docId: string): string[] {
  if (target && /\.png$/i.test(target)) {
    if (widths.length !== 1) throw new Error("-o with a .png file needs exactly one --width; pass a directory to write one file per width");
    return [resolvePath(target)];
  }
  const id = String(docId).replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+/, "") || "kage";
  return widths.map((w) => resolvePath(target ?? ".", `${id}-${w}.png`));
}
