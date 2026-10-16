// An opaque origin plus a restrictive CSP denies ambient access even if a
// trusted component later contains a script-injection bug. Asset hashes are
// supplied by the host, never by executable text from the document.
export function sandboxHtml(origin: string, runtime: { path: string; integrity: string }, integrity: Record<string, string>, instance: string): string {
  if (!/^\/runtime\/[A-Za-z0-9_-]+\.js$/.test(runtime.path) || !/^[A-Za-z0-9_-]+$/.test(instance)) throw new Error("invalid frame asset path");
  const scriptHashes = [runtime.integrity, integrity["bundle.js"]];
  if (!scriptHashes.every(h => /^sha384-[A-Za-z0-9+/]+={0,2}$/.test(h))) throw new Error("invalid frame integrity");
  const base = new URL(origin).origin;
  const csp = `default-src 'none'; script-src ${scriptHashes.map(h => `'${h}'`).join(" ")}; style-src ${base} https://fonts.googleapis.com 'unsafe-inline'; img-src https: data: ${base}; font-src ${base} https://fonts.gstatic.com data:; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}#root{display:flow-root}</style></head><body><div id="root"></div><script src="${base}${runtime.path}" integrity="${runtime.integrity}" crossorigin="anonymous"></script><!--${instance}--></body></html>`;
}
