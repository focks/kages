# Deployment

Kages runs three ways: on your machine with no server, as a local app, or hosted with a database and sign-in. Start at the top and stop at the first one that is enough.

## Local

Everything works without a server. `kages` keeps a workspace in `./.kages` (or the folder in `KAGES_HOME`): signed versions, comments, briefs and critiques in `store.json`, settings in `config.json`.

```sh
kages init
kages mcp         # serve the operations to an agent over stdio
```

## The app

The Library and public share links run as a Next.js app:

```sh
npm run dev
```

With no database configured, the app keeps its workspace in memory.

## Authentication is closed by default

Without both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, a deployed app is **read-only**: every caller is anonymous and nothing can be written. This is deliberate. A deployment that loses a variable must not become an open administrator on a shared workspace.

For a local run without accounts, say so: `npm run dev` does it for you, and for a built app use `KAGES_LOCAL_MODE=1 npm run start`. In that mode everyone is the demo admin of a shared workspace, so never set it on anything reachable by others.

Writes from a browser must come from the app's own pages; a request from another site is refused, so a signed-in session cannot be driven by someone else's page. Scripts and agents send a bearer token instead.

## Postgres

Set `DATABASE_URL` and run `npm run db:setup` to create the tables. Writes are compare-and-swap, so two processes cannot silently overwrite each other.

## Hosted

The hosted endpoint serves the MCP operations at `/api/mcp` with bearer-token auth. Without a token it is read-only and public. Sign in with `kages auth login` to act on your own workspace. The [REST API](rest-api.md) covers the HTTP surface, authentication and status codes.

## Speed

Artifacts run in a sandboxed frame that downloads the runtime, the design system and its styles. The frame asks for all three at once and requests the web fonts in parallel, instead of one after another. Files with a hash in their name (`/ds/versions/…`, `/runtime/….js`) are served with a one-year `immutable` cache header, so a repeat view downloads nothing; the unhashed aliases are revalidated. If you put a CDN in front, keep those headers. Repeated cards past the first screen are skipped by the browser until you scroll to them, and a page of 2,000 cards updates in about a tenth of a second.

## Install into your tools

`kages install` writes skills, slash commands, agents and the edit hook for the tools it finds. `kages check` exits 1 if what is installed is missing or older than the CLI, and `kages doctor` reports drift anywhere else.

## Plugins

Plugin files for Claude Code and Cursor are generated from the sources with `npm run build:plugins`. Point them at your own server by setting `KAGES_PLUGIN_MCP_URL` when you build.
