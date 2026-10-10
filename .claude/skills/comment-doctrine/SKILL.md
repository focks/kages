---
name: comment-doctrine
description: "How to comment code in this repo — the devi doctrine. Comment the WHY and the FAILURE MODE a line guards against, never the WHAT the code already says. Dense narrative block comments above each logical section; a doc comment on every exported function stating the invariant it guarantees and the subtle caveat; inline rationale on any non-obvious constant, regex, or branch. Apply when writing or editing any .ts/.tsx/.js in this repository, and when reviewing a diff for comment quality."
---

# comment-doctrine

Comments here earn their place by saying what the code cannot. The reader can
see *what* a line does; they cannot see *why it must be that way*, *what breaks
if you change it*, or *which real failure put it there*. That is the comment's
job. A comment that restates the code is noise the next reader has to skip; a
comment that encodes a hard-won reason is the most valuable line in the file.

## The rule

> Comment the **why** and the **failure mode**, never the **what**.
> If deleting the comment loses no information the code doesn't already carry,
> delete it.

## Four kinds that earn their place

1. **File header** — one paragraph: what this module is, its single
   responsibility, and the oracle/spec it answers to. Link the feature file it
   satisfies (`See oracle/validator.feature`).

2. **Section block** — above a non-obvious algorithm, a dense paragraph naming
   the problem it solves and the trap it avoids. This is where devi shines:

   ```ts
   // Two passes, not one: a $block reference can point at a block defined later
   // in the map, and we can only check that the target's output is public once
   // every block's type has resolved. Pass one resolves + checks props/slots;
   // pass two, with the full `resolved` map in hand, checks refs and actions.
   ```

3. **Function doc** — state the **invariant guaranteed** and the **caveat the
   caller must know**, not the parameter list:

   ```ts
   /** Read a dot path across own enumerable keys only. Returns undefined on any
    *  miss — never throws, never walks the prototype chain, so a crafted
    *  "__proto__.polluted" path resolves to undefined instead of reaching
    *  Object.prototype. This is the one guard that makes expressions safe to run
    *  on untrusted documents. */
   ```

4. **Inline rationale** — on a constant, regex, or branch whose value is a
   decision, name the decision and its ceiling:

   ```ts
   if ((depth || 0) > 8) // loop guard: commands can call commands; 8 is deep
   const q = String(...).toLowerCase(); // contains is case-insensitive by spec
   ```

## Write it like devi

- Name the **real failure**, concretely: "a half-open TCP socket after a DB
  restart shows up as a goroutine stuck in net.Read" beats "handle network
  errors". In this repo: "a model emits a trailing comma" beats "parse safely".
- State the **consequence of getting it wrong**: "the permit is never released
  and the whole dispatcher wedges" / "the escape-hatch HTML would run with
  same-origin and read the user's session".
- Pin **why a number is that number**: `// ms`, `// at most 6 — Ledger's
  segmented control, pin core/dropdown@1 for longer`.
- When porting from the oracle, say so and say where: `// Ported from the oracle
  bundle (window.Kages.validate).` The reader must know the authority.

## Never

- Narrate the obvious: `// loop over blocks` above `blocks.forEach`.
- Say *where code came from* for its own sake, or *that a change is correct* —
  that's talking to the reviewer, and it's noise the moment the PR merges.
- Leave a TODO without the trigger that retires it: `// TODO: per-account locks
  if throughput matters`, not `// TODO: improve`.
- Comment dead or deleted code. Delete it; git remembers.

## The test

Before keeping a comment, ask: *if I delete this, does a competent reader lose
something the code doesn't tell them?* No → delete. Yes → it stays, and make it
specific enough to be worth the line.
