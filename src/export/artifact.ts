// Turn a Kage into the single-file page that Claude's Artifact tool publishes.
// The host wraps the file in its own document skeleton and enforces a CSP that blocks
// every load but inline code, so this inlines everything: the app's own renderer
// (src/runtime/artifact-entry.tsx), the design-system bundle and the document as inert
// JSON. Running the app's renderer, not the bundle's own, keeps the shared engine's
// expression work budget, the per-block error boundaries and the pinned-contract
// resolution. Pure: the caller supplies the file contents, so the function is testable
// and never reads a disk or network.
import tokens from "../../public/ds/tokens.json" with { type: "json" };
import { designCss, readSnapshot } from "../engine/design.ts";
import { contracts } from "../engine/data.ts";
import type { KageDoc } from "../engine/types.ts";

export interface ArtifactAssets { tokensCss: string; bundleCss: string; bundleJs: string; runtimeJs: string }

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

/** The inlined runtime resolves each block's pinned contract in its own compiled registry, then draws it with
 *  the supplied bundle. A contract that only an older bundle still ships is unknown to that registry, so the
 *  block would render as "Pinned contract unavailable". Say so at export, naming the block, instead of
 *  publishing a page with a broken block. */
export function assertPinsAvailable(doc: KageDoc): void {
  for (const [block, ref] of Object.entries(doc.resolved?.blocks ?? {})) {
    if (!(contracts as Record<string, unknown>)[ref]) throw new Error(`block '${block}' pins ${ref}, which this build's runtime no longer includes; open the Kage and save a new version, then export again`);
  }
}

export function artifactHtml(doc: KageDoc, assets: ArtifactAssets): string {
  assertPinsAvailable(doc);
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
  // The renderer applies the pinned workspace design itself; its web fonts still need a <link>, the only
  // way the artifact contract loads a font, so take them from the same checked stylesheet the renderer uses.
  const design = readSnapshot(doc.resolved?.design);
  const sheets = [assets.tokensCss, assets.bundleCss].map(hoistFontImports);
  const links = [...new Set([...sheets.flatMap((x) => x.links), ...(design ? hoistFontImports(designCss(design)).links : [])])].map((u) => `<link rel="stylesheet" href="${escapeHtml(u).replace(/"/g, "&quot;")}">`).join("\n");
  const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
${links}
<style>
${sheets.map((x) => inertStyle(x.css)).join("\n")}
${page}
</style>
<div id="kage"></div>
<script>${inertScript(assets.runtimeJs)}</script>
<script>${inertScript(assets.bundleJs)}</script>
<script type="application/json" id="kage-doc">${inertJson(doc)}</script>
<script>
(function () {
  var root = document.documentElement;
  var media = matchMedia("(prefers-color-scheme: dark)");
  // The viewer sets data-theme for an explicit choice and nothing for "system".
  function sync() { var t = root.getAttribute("data-theme"); root.classList.toggle("dark", t ? t === "dark" : media.matches); }
  sync(); media.addEventListener("change", sync); new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  window.__kagesArtifact.mount(document.getElementById("kage"), JSON.parse(document.getElementById("kage-doc").textContent));
})();
</script>
`;
  if (Buffer.byteLength(html) > ARTIFACT_MAX_BYTES) throw new Error("this Kage is too large to export as an artifact page");
  return html;
}
