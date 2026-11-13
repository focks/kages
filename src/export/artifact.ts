// Turn a Kage into the single-file page that Claude's Artifact tool publishes.
// The host wraps the file in its own document skeleton and enforces a CSP, so this
// emits only what that contract allows: a <title>, one <style>, React from the
// cdnjs allowlist, the design-system bundle inlined (any other host is blocked
// with no visible error) and the document as inert JSON. Pure: the caller supplies
// the bundle text, so the function is testable and never reads a disk or network.
import tokens from "../../public/ds/tokens.json" with { type: "json" };
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import { designCss, readSnapshot } from "../engine/design.ts";
import { systems } from "../engine/data.ts";
import type { KageDoc } from "../engine/types.ts";

export interface ArtifactAssets { tokensCss: string; bundleCss: string; bundleJs: string }

/** Pinned exact versions, as the artifact CSP requires; both are far older than the two-week floor. */
export const REACT_CDN = "https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js";
export const REACT_DOM_CDN = "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js";
/** The host rejects pages over 16 MB; leave room for its skeleton. */
export const ARTIFACT_MAX_BYTES = 15 * 1024 * 1024;

const SYSTEM_PAPER: Record<string, string> = { core: "paper", ledger: "ledger-paper", atelier: "atelier-paper" };

function pageGround(system: string): { light: string; dark: string } {
  const name = SYSTEM_PAPER[system] ?? "paper";
  const t = (tokens.color.tokens as { name: string; value: { light: string; dark: string } }[]).find((x) => x.name === name);
  return t ? t.value : { light: "#f4f2ec", dark: "#141513" };
}

/** Inline text cannot end its own element, so the two sequences that would are escaped; JSON stays valid. */
const inertJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const inertScript = (s: string) => s.replace(/<\/(script)/gi, "<\\/$1");
const inertStyle = (s: string) => s.replace(/<\/(style)/gi, "<\\/$1");

/** An @import is ignored once any other rule precedes it, and the three stylesheets are concatenated, so
 *  each leading @import is lifted out. The artifact contract loads web fonts with a <link> to Google Fonts
 *  and nothing else, so only those are kept; the rest of the sheet is returned untouched. */
export function hoistFontImports(css: string): { css: string; links: string[] } {
  const links: string[] = [];
  // The quoted URL is matched whole: Google Fonts URLs contain ";" (wght@400;500), so stopping at the
  // first one would leave the tail of the URL behind as stray CSS that swallows the next rule.
  const rest = css.replace(/@import\s+(?:url\(\s*)?(["'])(.*?)\1\s*\)?[^;]*;/g, (_m, _q: string, url: string) => { if (/^https:\/\/fonts\.googleapis\.com\/css2?\?[^"'\s<>]+$/.test(url)) links.push(url); return ""; });
  return { css: rest, links };
}

/** The oracle renderer resolves each role to the contract of the build it ships in, so a document whose
 *  version pinned an older contract would silently render differently. When the version also pinned its
 *  assets the matching build is loaded instead; when it did not (older records) the pins can only be
 *  honoured if they still equal what the current system resolves, otherwise refuse to export. */
export function assertPinsRenderable(doc: KageDoc): void {
  if (doc.resolved?.assets) return;
  for (const [block, ref] of Object.entries(doc.resolved?.blocks ?? {})) {
    // A pin names its own system ("core/button@1.1.0"), which is not always the document's: a Ledger
    // document may use a core block. Compare against the system the pin names, never the document's.
    const m = /^([a-z0-9-]+)\/([a-z0-9-]+)@/.exec(ref);
    const current = m ? (systems[m[1]]?.components as Record<string, string> | undefined)?.[m[2]] : undefined;
    if (current && current !== ref) throw new Error(`block '${block}' pins ${ref} but this build renders ${current}; export needs the design-system build that Kage was signed against`);
  }
}

/** The exported page boots the design-system bundle's own renderer, which has neither the shared engine's
 *  expression work budget nor the per-block error boundaries of the app's runtime. A document that is valid
 *  can still make that renderer run for ever or throw, taking the viewer's page with it. So render it once
 *  here, with the very bundle being exported, under a time limit, and refuse to export what does not finish
 *  cleanly. React comes from the app's own dependencies and is loaded only when exporting, which keeps it out
 *  of the single-file CLI (which cannot export an artifact anyway). */
const RENDER_BUDGET_MS = 3000;
const loaded = new Map<string, { K: { KageRenderer: unknown }; React: unknown; server: { renderToStaticMarkup: (el: unknown) => string } }>();
export function assertRendersSafely(doc: KageDoc, assets: ArtifactAssets): void {
  const need = createRequire(import.meta.url);
  const modules = ["react", "react-dom/server"];
  let entry = loaded.get(assets.bundleJs);
  if (!entry) {
    const React = need(modules[0]), server = need(modules[1]), window: Record<string, unknown> = { React };
    try { runInNewContext(assets.bundleJs, { window, console: { log() {}, warn() {}, error() {} }, Intl, document: {} }, { timeout: RENDER_BUDGET_MS }); }
    catch { throw new Error("the design-system bundle could not be loaded to check this Kage before export"); }
    entry = { K: window.Kages as { KageRenderer: unknown }, React, server };
    loaded.set(assets.bundleJs, entry);
  }
  const e = entry;
  try {
    // The render runs inside the VM so the timeout can interrupt a runaway expression.
    runInNewContext("html = server.renderToStaticMarkup(React.createElement(K.KageRenderer, { doc: doc }))", { server: e.server, React: e.React, K: e.K, doc: JSON.parse(JSON.stringify(doc)), html: "" }, { timeout: RENDER_BUDGET_MS });
  } catch (err) {
    const why = /timed out/i.test(String((err as Error).message)) ? `it needed more than ${RENDER_BUDGET_MS / 1000}s to render` : String((err as Error).message).split("\n")[0].slice(0, 160);
    throw new Error(`this Kage cannot be exported as an artifact page because ${why}; fix the block or expression first`);
  }
}

export function artifactHtml(doc: KageDoc, assets: ArtifactAssets): string {
  assertPinsRenderable(doc);
  assertRendersSafely(doc, assets);
  const system = String(doc.system ?? "core").split("@")[0];
  const ground = pageGround(system);
  const title = escapeHtml(String(doc.title ?? doc.id ?? "Kage").slice(0, 120));
  // Tokens on bare :root, dark values redefined for the OS setting and again for an explicit
  // choice, so the page never shows one theme's text on the other theme's background.
  const page = `:root { --page-bg: ${ground.light}; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --page-bg: ${ground.dark}; color-scheme: dark; } }
:root[data-theme="dark"] { --page-bg: ${ground.dark}; color-scheme: dark; }
body { background: var(--page-bg); }
#kage { padding-block: 16px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }`;
  // The pinned workspace design restyles the Kage through the same checked stylesheet the app uses.
  const design = readSnapshot(doc.resolved?.design);
  const sheets = [assets.tokensCss, assets.bundleCss, design ? designCss(design) : ""].map(hoistFontImports);
  const links = [...new Set(sheets.flatMap((x) => x.links))].map((u) => `<link rel="stylesheet" href="${escapeHtml(u).replace(/"/g, "&quot;")}">`).join("\n");
  const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${links}
<style>
${sheets.map((x) => inertStyle(x.css)).join("\n")}
${page}
</style>
<div id="kage"></div>
<script src="${REACT_CDN}"></script>
<script src="${REACT_DOM_CDN}"></script>
<script>${inertScript(assets.bundleJs)}</script>
<script type="application/json" id="kage-doc">${inertJson(doc)}</script>
<script>
(function () {
  var root = document.documentElement;
  var media = matchMedia("(prefers-color-scheme: dark)");
  // The viewer sets data-theme for an explicit choice and nothing for "system".
  function sync() { var t = root.getAttribute("data-theme"); root.classList.toggle("dark", t ? t === "dark" : media.matches); }
  sync(); media.addEventListener("change", sync); new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  var doc = JSON.parse(document.getElementById("kage-doc").textContent);
  // One failing block must not blank the page: this boundary shows a notice instead of an empty frame.
  function Guard(props) { React.Component.call(this, props); this.state = { failed: false }; }
  Guard.prototype = Object.create(React.Component.prototype);
  Guard.getDerivedStateFromError = function () { return { failed: true }; };
  Guard.prototype.render = function () { return this.state.failed ? React.createElement("p", { role: "alert", className: "kg-missing" }, "This page could not be shown.") : this.props.children; };
  ReactDOM.createRoot(document.getElementById("kage")).render(React.createElement(Guard, null, React.createElement(Kages.KageRenderer, { doc: doc, className: ${design ? '"kg-design"' : "undefined"} })));
})();
</script>
`;
  if (Buffer.byteLength(html) > ARTIFACT_MAX_BYTES) throw new Error("this Kage is too large to export as an artifact page");
  return html;
}
