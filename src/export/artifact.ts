// Turn a Kage into the single-file page that Claude's Artifact tool publishes.
// The host wraps the file in its own document skeleton and enforces a CSP, so this
// emits only what that contract allows: a <title>, one <style>, React from the
// cdnjs allowlist, the design-system bundle inlined (any other host is blocked
// with no visible error) and the document as inert JSON. Pure: the caller supplies
// the bundle text, so the function is testable and never reads a disk or network.
import tokens from "../../public/ds/tokens.json" with { type: "json" };
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

export function artifactHtml(doc: KageDoc, assets: ArtifactAssets): string {
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
  const html = `<title>${title}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${inertStyle(assets.tokensCss)}
${inertStyle(assets.bundleCss)}
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
  ReactDOM.createRoot(document.getElementById("kage")).render(React.createElement(Kages.KageRenderer, { doc: doc }));
})();
</script>
`;
  if (Buffer.byteLength(html) > ARTIFACT_MAX_BYTES) throw new Error("this Kage is too large to export as an artifact page");
  return html;
}
