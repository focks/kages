// RFC 6902 JSON Patch — the only way an agent edits a Kage, so changes stay
// small, reviewable and atomic. We apply onto a deep clone and return the new
// document; the caller validates the result before committing, so a patch that
// produces an invalid Kage is rejected whole rather than leaving a half-edited
// doc. A throwing op (bad pointer, missing target) aborts the entire patch for
// the same reason. See oracle/kage-document.feature.

type Json = any;

export interface PatchOp {
  op: "add" | "remove" | "replace" | "move" | "copy" | "test";
  path: string;
  value?: Json;
  from?: string;
}

class PatchError extends Error {}

// Pointer tokens that would reach the prototype chain. A patch like
// `/__proto__/x` otherwise walks node["__proto__"] to Object.prototype and
// writes there, polluting every object in the process. Refused outright.
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** Parse a JSON Pointer ("/blocks/kpi/slots/children/-") into decoded tokens.
 *  Refuses any token that would traverse the prototype chain. */
function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (pointer[0] !== "/") throw new PatchError(`bad pointer '${pointer}'`);
  const tokens = pointer.slice(1).split("/").map((t) => t.replace(/~1/g, "/").replace(/~0/g, "~"));
  for (const t of tokens) if (FORBIDDEN.has(t)) throw new PatchError(`refused prototype key '${t}' in '${pointer}'`);
  return tokens;
}

function clone<T>(x: T): T {
  return x == null ? x : JSON.parse(JSON.stringify(x));
}

/** Resolve the container holding the final token, so an op can read/write it.
 *  Object access is own-property only — an inherited key resolves to "not
 *  found", never to something on the prototype chain. */
function locate(root: Json, tokens: string[]): { parent: Json; key: string } {
  let node = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (node == null || typeof node !== "object") throw new PatchError(`path not found at '${t}'`);
    if (Array.isArray(node)) node = node[Number(t)];
    else if (Object.prototype.hasOwnProperty.call(node, t)) node = node[t];
    else throw new PatchError(`path not found at '${t}'`);
  }
  return { parent: node, key: tokens[tokens.length - 1] };
}

function getAt(root: Json, tokens: string[]): Json {
  if (tokens.length === 0) return root;
  const { parent, key } = locate(root, tokens);
  if (parent == null) throw new PatchError("path not found");
  return Array.isArray(parent) ? parent[Number(key)] : parent[key];
}

function addAt(root: Json, tokens: string[], value: Json): Json {
  if (tokens.length === 0) return value;
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    // "-" appends; otherwise insert before the index (RFC 6902 array add).
    const idx = key === "-" ? parent.length : Number(key);
    if (idx < 0 || idx > parent.length) throw new PatchError(`array index out of range '${key}'`);
    parent.splice(idx, 0, value);
  } else if (parent && typeof parent === "object") {
    parent[key] = value;
  } else {
    throw new PatchError("cannot add to a non-container");
  }
  return root;
}

function removeAt(root: Json, tokens: string[]): Json {
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    const idx = Number(key);
    if (idx < 0 || idx >= parent.length) throw new PatchError(`array index out of range '${key}'`);
    parent.splice(idx, 1);
  } else if (parent && typeof parent === "object") {
    if (!(key in parent)) throw new PatchError(`cannot remove missing key '${key}'`);
    delete parent[key];
  } else {
    throw new PatchError("cannot remove from a non-container");
  }
  return root;
}

/** Apply a patch to a document. Pure: returns a new document, never mutates the
 *  input. Throws PatchError on any invalid op, which the caller treats as a
 *  rejected (atomic) edit. */
export function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  let root: Json = clone(doc);
  for (const op of ops) {
    const tokens = parsePointer(op.path);
    switch (op.op) {
      case "add": root = addAt(root, tokens, clone(op.value)); break;
      case "remove": root = removeAt(root, tokens); break;
      case "replace": removeAt(root, tokens); root = addAt(root, tokens, clone(op.value)); break;
      case "move": {
        const from = parsePointer(op.from as string);
        const moved = getAt(root, from);
        removeAt(root, from);
        root = addAt(root, tokens, moved);
        break;
      }
      case "copy": root = addAt(root, tokens, clone(getAt(root, parsePointer(op.from as string)))); break;
      case "test": {
        const actual = getAt(root, tokens);
        if (JSON.stringify(actual) !== JSON.stringify(op.value)) throw new PatchError(`test failed at '${op.path}'`);
        break;
      }
      default: throw new PatchError(`unknown op '${(op as PatchOp).op}'`);
    }
  }
  return root as T;
}

export { PatchError };
