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

class PatchError extends Error {
  /** Which op in the list failed (0-based), so a caller can fix the right one. */
  opIndex?: number;
}

// Pointer tokens that would reach the prototype chain. A patch like
// `/__proto__/x` otherwise walks node["__proto__"] to Object.prototype and
// writes there, polluting every object in the process. Refused outright.
const FORBIDDEN = new Set(["__proto__", "constructor", "prototype"]);

/** Parse a JSON Pointer ("/blocks/kpi/slots/children/-") into decoded tokens.
 *  Refuses any token that would traverse the prototype chain. */
function parsePointer(pointer: string): string[] {
  if (pointer === "") return [];
  if (typeof pointer !== "string" || pointer[0] !== "/") throw new PatchError(`bad pointer '${pointer}'`);
  if (/~(?![01])/.test(pointer)) throw new PatchError(`bad pointer escape in '${pointer}'`);
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
// Number() accepts NaN, fractions and leading zeroes; splice then silently targets
// another element. Only RFC 6901 array tokens may reach an array operation.
function arrayIndex(key: string, length: number, append = false): number {
  if (append && key === "-") return length;
  if (!/^(0|[1-9][0-9]*)$/.test(key)) throw new PatchError(`invalid array index '${key}'`);
  const n = Number(key);
  if (!Number.isSafeInteger(n) || n >= length + (append ? 1 : 0)) throw new PatchError(`array index out of range '${key}'`);
  return n;
}

function locate(root: Json, tokens: string[]): { parent: Json; key: string } {
  let node = root;
  for (let i = 0; i < tokens.length - 1; i++) {
    const t = tokens[i];
    if (node == null || typeof node !== "object") throw new PatchError(`path not found at '${t}'`);
    if (Array.isArray(node)) node = node[arrayIndex(t, node.length)];
    else if (Object.prototype.hasOwnProperty.call(node, t)) node = node[t];
    else throw new PatchError(`path not found at '${t}'`);
  }
  return { parent: node, key: tokens[tokens.length - 1] };
}

function getAt(root: Json, tokens: string[]): Json {
  if (tokens.length === 0) return root;
  const { parent, key } = locate(root, tokens);
  if (parent == null) throw new PatchError("path not found");
  if (Array.isArray(parent)) return parent[arrayIndex(key, parent.length)];
  if (typeof parent !== "object" || !Object.prototype.hasOwnProperty.call(parent, key)) throw new PatchError(`path not found at '${key}'`);
  return parent[key];
}

function addAt(root: Json, tokens: string[], value: Json): Json {
  if (tokens.length === 0) return value;
  const { parent, key } = locate(root, tokens);
  if (Array.isArray(parent)) {
    // "-" appends; otherwise insert before the index (RFC 6902 array add).
    const idx = arrayIndex(key, parent.length, true);
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
    const idx = arrayIndex(key, parent.length);
    if (idx < 0 || idx >= parent.length) throw new PatchError(`array index out of range '${key}'`);
    parent.splice(idx, 1);
  } else if (parent && typeof parent === "object") {
    if (!Object.prototype.hasOwnProperty.call(parent, key)) throw new PatchError(`cannot remove missing key '${key}'`);
    delete parent[key];
  } else {
    throw new PatchError("cannot remove from a non-container");
  }
  return root;
}

/** Total JSON characters one patch may duplicate with `copy`. A copy deep-clones its
 *  source, so copying a subtree into itself 40 times grows a document 2^40-fold from a
 *  request of a few KB, exhausting memory before any later size check could run. */
export const MAX_COPY_CHARS = 1_000_000;

/** Apply a patch to a document. Pure: returns a new document, never mutates the
 *  input. Throws PatchError on any invalid op, which the caller treats as a
 *  rejected (atomic) edit. */
export function applyPatch<T>(doc: T, ops: PatchOp[]): T {
  let root: Json = clone(doc);
  const budget = { copied: 0 };
  for (const [i, op] of ops.entries()) {
    try { root = applyOne(root, op, budget); }
    catch (e) {
      if (!(e instanceof PatchError)) throw e;
      const named = new PatchError(`op ${i} (${op?.op} ${op?.path}): ${e.message}`);
      named.opIndex = i;
      throw named;
    }
  }
  return root as T;
}

function applyOne(root: Json, op: PatchOp, budget: { copied: number }): Json {
  // RFC 6902 requires these. Without the check, a `replace` with a misnested value
  // clones undefined and quietly deletes the target, then succeeds as a new version.
  if ((op.op === "add" || op.op === "replace" || op.op === "test") && !Object.prototype.hasOwnProperty.call(op, "value")) throw new PatchError(`\`${op.op}\` needs a \`value\``);
  if ((op.op === "move" || op.op === "copy") && typeof op.from !== "string") throw new PatchError(`\`${op.op}\` needs a \`from\` pointer`);
  const tokens = parsePointer(op.path);
  switch (op.op) {
    case "add": return addAt(root, tokens, clone(op.value));
    case "remove": return tokens.length ? removeAt(root, tokens) : undefined;
    case "replace": getAt(root, tokens); return tokens.length ? (removeAt(root, tokens), addAt(root, tokens, clone(op.value))) : clone(op.value);
    case "move": {
      const from = parsePointer(op.from as string);
      if (tokens.length > from.length && from.every((t, i) => tokens[i] === t)) throw new PatchError("cannot move into a descendant");
      if (op.from === op.path) { getAt(root, from); return root; }
      const moved = getAt(root, from);
      removeAt(root, from);
      return addAt(root, tokens, moved);
    }
    case "copy": {
      const source = getAt(root, parsePointer(op.from as string));
      // Measured before cloning: earlier copies were within budget, so the source is bounded too.
      budget.copied += JSON.stringify(source)?.length ?? 0;
      if (budget.copied > MAX_COPY_CHARS) throw new PatchError(`copy limit exceeded: a patch may duplicate at most ${MAX_COPY_CHARS} characters`);
      return addAt(root, tokens, clone(source));
    }
    case "test": {
      const actual = getAt(root, tokens);
      if (!equal(actual, op.value)) throw new PatchError(`test failed at '${op.path}'`);
      return root;
    }
    default: throw new PatchError(`unknown op '${(op as PatchOp).op}'`);
  }
}

const VERBS = new Set(["add", "remove", "replace", "move", "copy", "test"]);

/** Structural check of an untrusted op list, with no document: every entry is an object with a known
 *  verb and a path (and `from` where the verb needs one) that parsePointer accepts. Returns the first
 *  problem, or null. Stored suggestions are never applied here, so this is what keeps a `null` op or
 *  a prototype pointer out of the snapshot that UI code later maps over. */
export function checkPatchOps(ops: unknown): string | null {
  if (!Array.isArray(ops)) return "a patch is a list of operations";
  for (const [i, op] of ops.entries()) {
    if (op === null || typeof op !== "object" || Array.isArray(op)) return `op ${i} is not an object`;
    const o = op as Record<string, unknown>;
    if (typeof o.op !== "string" || !VERBS.has(o.op)) return `op ${i} has an unknown verb`;
    if (typeof o.path !== "string") return `op ${i} needs a string path`;
    if ((o.op === "move" || o.op === "copy") && typeof o.from !== "string") return `op ${i} needs a string from`;
    try { parsePointer(o.path); if (typeof o.from === "string") parsePointer(o.from); }
    catch (e) { return `op ${i}: ${(e as Error).message}`; }
  }
  return null;
}

export { PatchError };

// Object key order is not significant in a JSON Patch test operation.
function equal(a: Json, b: Json): boolean {
  if (a === b) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every(k => Object.prototype.hasOwnProperty.call(b, k) && equal(a[k], b[k]));
}
