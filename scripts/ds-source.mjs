// Extensions are compiled into the reference's closure before inheritance is
// resolved. Loading a second registry would let the validator accept blocks
// the oracle renderer cannot resolve. Both goldens and the served bundle must
// consume these same bytes. See oracle/free-flow.feature.
import { existsSync, readFileSync } from "node:fs";

/** Resolve a reference-oracle file. A local originals/ checkout wins (it is the
 * source of truth); otherwise fall back to the tracked reference/ snapshot so a
 * fresh clone can run build:ds. The snapshot is byte-identical to the pristine
 * oracle (recovered from the first commit), and a rebuild from it must
 * reproduce the served bundle exactly. */
export function referenceFile(rel) {
  const live = "originals/" + rel;
  return readFileSync(existsSync(live) ? live : "reference/" + rel, "utf8");
}

/** Keep the original contracts unchanged while giving the oracle and browser
 * the same additional implementations. Fail on a moved anchor rather than
 * silently shipping a bundle with missing roles. */
export function referenceBundle() {
  let source = referenceFile("project/components/bundle.js");
  const additions = readFileSync("src/design-system/free-flow.js", "utf8") + "\n" + readFileSync("src/design-system/expressive.js", "utf8");
  const capabilities = readFileSync("src/engine/advanced.js", "utf8").replace(/^export /gm, "");
  const operations = readFileSync("src/design-system/advanced-oracle.js", "utf8");
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
    ["  var api = {", capabilities + "\n" + operations + "\n  var api = {"],
    ["  var ledger = {", additions + "\n  var ledger = {"],
    ["  W.Kages = W.Kages || {};", "  Object.keys(freeFlowExports).forEach(function (name) { api[name] = freeFlowExports[name]; });\n  W.Kages = W.Kages || {};"],
  ]) {
    if (source.split(anchor).length !== 2) throw new Error("Reference bundle anchor changed: " + anchor);
    source = source.replace(anchor, insertion);
  }
  // The renderer expands from its live state on every render; expanding only
  // once at mount would leave filters and computed repeat lists frozen.
  const patches = [
    ["    var ctx = makeCtx(doc, sysId, state, locals);", "    try { doc = expandDocument(doc, makeCtx(doc, sysId, state, locals), evaluate, getPath, function (d) { return makeCtx(d, sysId, state, merge(initLocals(d, sysId), locals)); }); } catch (e) { return h(Missing, { id: 'collection', msg: e.message }); }\n    locals = merge(initLocals(doc, sysId), locals);\n    var ctx = makeCtx(doc, sysId, state, locals);"],
    ["[b.props, b.bind, b.visible, b.on]", "[b.props, b.bind, b.visible, b.on, b.repeat && b.repeat.each]"],
    ["if (isExpr(x)) fn(Object.keys(x)[0], x[Object.keys(x)[0]]); for", "if (isExpr(x)) fn(Object.keys(x)[0], x[Object.keys(x)[0]]); if (Object.keys(x)[0] === '$literal') return; for"],
    ["busy[id] = false; cache[id] = out; return out;", "var outputType = b.type === 'composition' && doc.compositions && doc.compositions[b.props.name] && doc.compositions[b.props.name].outputType; if (outputType && !matchesInput(outputType, out.value)) throw new Error('Invalid composition output at ' + id);\n      busy[id] = false; cache[id] = out; return out;"],
  ];
  for (const [anchor, replacement] of patches) {
    if (source.split(anchor).length !== 2) throw new Error("Reference capability anchor changed: " + anchor);
    source = source.replace(anchor, replacement);
  }
  // Additive roles change catalog capabilities, so every inheriting system
  // advertises a minor release; the existing component refs stay immutable.
  source = source.replace('version: "1.4.0", className: "kg-sys-core"', 'version: "1.6.0", className: "kg-sys-core"')
    .replace('version: "2.1.0", className: "kg-sys-ledger"', 'version: "2.3.0", className: "kg-sys-ledger"')
    .replace('version: "1.0.0", className: "kg-sys-atelier"', 'version: "1.2.0", className: "kg-sys-atelier"');
  return source;
}
