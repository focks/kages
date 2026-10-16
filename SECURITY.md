# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through GitHub:
**Security → Report a vulnerability** on https://github.com/focks/kages
(private vulnerability reporting). Include what you found, how to reproduce it,
and what an attacker gains. You will get an acknowledgement within a few days,
and we will agree a disclosure date with you once a fix is ready.

## Supported versions

Only the latest release on `main` is supported while the project is pre-1.0 in
practice. Fixes are not back-ported.

## What is in scope

The server, store, operation adapters (REST, MCP, A2A, CLI), the host bridge and
sandboxed renderer, share links, and the generated plugin and docs files. Reports
about private data being readable, writes being accepted without the right
identity, cross-site request forgery, sandbox escapes and secret leakage are the
most valuable.

## Design choices you should know about

These are deliberate, so they are not vulnerabilities, but we want to hear if you
can make them worse:

- **A Kage is untrusted data.** It is validated and rendered by a trusted bundle
  inside an opaque-origin sandbox; it never runs its own code. Host integrations
  cross a checked message port and direct `fetch` is denied.
- **Authentication fails closed.** With neither Supabase configured nor
  `KAGES_LOCAL_MODE=1`, the app refuses requests instead of acting as an
  anonymous owner.
- **Private Kages are concealed.** A caller who cannot read a Kage gets the same
  "not found" as for one that does not exist.
- **Guests can only add comments** to a Kage published by link or publicly, with
  a per-Kage cap. A guest's name is not verified.
- **The dry-run rate limit is per server process**, not shared across instances.

## For operators

Set `SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` only as server environment
variables, never in a `NEXT_PUBLIC_` variable. Never commit `.env.local`. Keep
dependencies current (`npm audit --omit=dev`).
