/** The web-font stylesheet that bundle.css pulls in with an @import on its first line. An @import is only discovered once
 *  bundle.css has arrived, and it holds the whole stylesheet back until the fonts' CSS has come too, so the frame asks for
 *  it up front, in parallel; the later @import is then answered from the cache. A test keeps this equal to the bundle's. */
export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500..800&family=DM+Sans:opsz,wght@9..40,400..700&family=Fraunces:opsz,wght@9..144,400..600&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap";

// An opaque origin plus a restrictive CSP denies ambient access even if a
// trusted component later contains a script-injection bug. Asset hashes are
// supplied by the host, never by executable text from the document.
//
// `dsBase` (the design-system folder the document pins) lets the frame start fetching the bundle at once. Without
// it the bundle is only discovered after the runtime script has run and the host has answered, so the two
// downloads queue one behind the other; preloaded, they overlap. The preload carries the same integrity and
// credentials mode as the later fetch, which is what lets the browser reuse it, and an unexpected base is
// simply not preloaded.
export function sandboxHtml(origin: string, runtime: { path: string; integrity: string }, integrity: Record<string, string>, instance: string, dsBase?: string, fill = false): string {
  if (!/^\/runtime\/[A-Za-z0-9_-]+\.js$/.test(runtime.path) || !/^[A-Za-z0-9_-]+$/.test(instance)) throw new Error("invalid frame asset path");
  const scriptHashes = [runtime.integrity, integrity["bundle.js"]];
  if (!scriptHashes.every(h => /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(h))) throw new Error("invalid frame integrity");
  const base = new URL(origin).origin;
  const csp = `default-src 'none'; script-src ${scriptHashes.map(h => `'${h}'`).join(" ")}; style-src ${base} https://fonts.googleapis.com 'unsafe-inline'; img-src https: data: ${base}; font-src ${base} https://fonts.gstatic.com data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'`;
  const files = ["tokens.css", "bundle.css", "bundle.js"];
  const preload = dsBase && /^\/ds(\/versions\/[A-Za-z0-9_-]+)?$/.test(dsBase) && files.every(f => /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(integrity[f] ?? ""))
    ? files.map(f => `<link rel="preload" as="${f.endsWith(".js") ? "script" : "style"}" href="${base}${dsBase}/${f}" integrity="${integrity[f]}" crossorigin="anonymous">`).join("") + `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${FONTS_CSS}">` : "";
  // Auto-height frames must chain wheel/touch scrolling to their host. This host-owned
  // rule also overrides the unconditional inline containment in older pinned runtimes.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Kage</title><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1">${preload}<style>html{overscroll-behavior:${fill ? "contain" : "auto"}!important}html,body{margin:0;padding:0}#root{display:flow-root}</style></head><body><div id="root"></div><script src="${base}${runtime.path}" integrity="${runtime.integrity}" crossorigin="anonymous"></script><!--${instance}--></body></html>`;
}
