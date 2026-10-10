---
name: testing-conventions
description: "How tests work in this repo: Node's built-in runner on native TypeScript, no framework; golden parity against the oracle; injected clocks/ids for determinism; and the TS-syntax subset that native type-stripping accepts. Read before adding a test or a testable module, so the test runs under `npm test` without a build step."
---

# testing-conventions

Tests run with `node --test "src/**/*.test.ts"` (`npm test`) on **native
TypeScript** — Node strips types at load, there is NO compile step and NO test
framework. That constraint shapes everything below.

## The rules

1. **No framework.** Use `node:test` (`test`, `describe`) and
   `node:assert/strict`. No vitest/jest, no fixtures library.

2. **Golden parity for engine behaviour.** Anything that mirrors the oracle
   asserts against a captured golden (`src/engine/__fixtures__/golden-*`), not a
   hand-written expectation. Add the golden first (`scripts/golden.mjs`), then
   the test. See `kages-architecture`.

3. **Inject the clock and ids — never read the wall clock in logic.** The store
   takes `clock: () => number`; tests pass a monotonic counter so version
   numbers, quota windows and claim leases are deterministic. The same applies
   to any id/random source. A test that depends on `Date.now()` is a flake.

4. **One runnable check per non-trivial module.** A branch, loop, parser, or
   money/security path leaves a `*.test.ts` beside it. Trivial one-liners don't.

5. **Relative imports in anything `node --test` runs.** The `@/` alias is a
   tsconfig/Next convenience; Node's runtime resolver does not know it. Engine,
   store, and collab use `../engine/...`. Only files that run *solely* under
   Next (components, pages) may use `@/`.

## The TypeScript subset native stripping accepts

Type-stripping removes annotations but will not EMIT code. So avoid constructs
that require codegen — they throw `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` at load:

- **No parameter properties.** `constructor(private x: T)` fails — declare the
  field and assign in the body.
- **No `enum`** (emits an object) — use `as const` unions.
- **No namespaces with runtime members, no experimental decorators.**
- Import JSON with an attribute: `import x from "./x.json" with { type: "json" }`.

Plain interfaces, type aliases, generics, `as`/`satisfies`, and `import type`
are all fine (pure annotations).

## Shape of a test

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { KageSession } from "./session.ts";        // .ts extension, relative

test("named behaviour, not 'it works'", () => {
  // arrange with injected determinism, act, assert the observable outcome
});
```

Name the behaviour and tie it to the requirement it covers
(`oracle/<file>.feature`), so a reader knows which rule a red test broke.
