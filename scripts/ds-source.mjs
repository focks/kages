// Extensions are compiled into the reference's closure before inheritance is
// resolved. Loading a second registry would let the validator accept blocks
// the oracle renderer cannot resolve. Both goldens and the served bundle must
// consume these same bytes. See oracle/free-flow.feature.
import { readFileSync } from "node:fs";

/** Keep the original contracts unchanged while giving the oracle and browser
 * the same additional implementations. Fail on a moved anchor rather than
 * silently shipping a bundle with missing roles. */
export function referenceBundle() {
  let source = readFileSync("originals/project/components/bundle.js", "utf8");
  const additions = readFileSync("src/design-system/free-flow.js", "utf8");
  // Bundle consumers also discover exports through the design-system header.
  // A stale manifest would hide roles that work in the runtime and catalog.
  const manifest = /^\/\* @ds-bundle: (.+) \*\//.exec(source);
  if (!manifest) throw new Error("Reference bundle manifest missing");
  const metadata = JSON.parse(manifest[1]);
  for (const match of additions.matchAll(/\b(Core[A-Z]\w*): Core[A-Z]\w*/g)) {
    metadata.components.push({ name: match[1] });
  }
  source = source.replace(manifest[0], "/* @ds-bundle: " + JSON.stringify(metadata) + " */");
  for (const [anchor, insertion] of [
    ["  var ledger = {", additions + "\n  var ledger = {"],
    ["  W.Kages = W.Kages || {};", "  Object.keys(freeFlowExports).forEach(function (name) { api[name] = freeFlowExports[name]; });\n  W.Kages = W.Kages || {};"],
  ]) {
    if (source.split(anchor).length !== 2) throw new Error("Reference bundle anchor changed: " + anchor);
    source = source.replace(anchor, insertion);
  }
  // Additive roles change catalog capabilities, so every inheriting system
  // advertises a minor release; the existing component refs stay immutable.
  source = source.replace('version: "1.4.0", className: "kg-sys-core"', 'version: "1.5.0", className: "kg-sys-core"')
    .replace('version: "2.1.0", className: "kg-sys-ledger"', 'version: "2.2.0", className: "kg-sys-ledger"')
    .replace('version: "1.0.0", className: "kg-sys-atelier"', 'version: "1.1.0", className: "kg-sys-atelier"');
  return source;
}
