import fs from "node:fs";
import vm from "node:vm";

const code = fs.readFileSync("originals/project/components/bundle.js", "utf8");

const noop = () => null;
const React = {
  createElement: noop, cloneElement: noop, createContext: () => ({ Provider: noop, Consumer: noop }),
  Fragment: "Fragment", memo: (f) => f, forwardRef: (f) => f,
  useState: (v) => [typeof v === "function" ? v() : v, noop], useRef: (v) => ({ current: v }),
  useMemo: (f) => f(), useEffect: noop, useLayoutEffect: noop, useCallback: (f) => f,
  useContext: () => ({}), useReducer: (r, v) => [v, noop], useId: () => "id",
};
const win = { React };
const sandbox = { window: win, self: win, globalThis: undefined, React, console, document: { createElement: () => ({}) } };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "bundle.js" });

const K = win.Kages;
console.log("exports:", Object.keys(K).join(", "));
const dump = (name, val) => fs.writeFileSync(`src/engine/data/${name}.json`, JSON.stringify(val, null, 2) + "\n");
dump("systems", K.systems);
dump("contracts", K.contracts);
dump("interfaces", K.interfaces);
console.log("systems:", Object.keys(K.systems).join(", "));
console.log("contracts:", Object.keys(K.contracts).length, "refs");
console.log("interfaces:", Object.keys(K.interfaces).join(", "));
