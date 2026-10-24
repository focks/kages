# Deploying and self-hosting Kages

Kages is a standard Next.js app. Everything needed to run your own instance is in
this repository: the app, auth integration, persistence code and database
migrations. Nothing here depends on the hosted service at getkages.com.

Two independent settings decide how an instance behaves:

| Setting | Options | Decided by |
| --- | --- | --- |
| **Identity** (who is calling) | local demo admin, closed (read-only), Supabase Auth | `src/server/auth-mode.ts` |
| **Persistence** (where data lives) | in-memory, plain Postgres, Supabase REST | `src/server/persistence.ts` |

A database does not supply authentication, and authentication does not supply a
database. Configure both for a shared deployment.

## 1. Local, no setup

```bash
npm ci
npm run dev        # http://localhost:3000
```

`next dev` runs in **local mode**: every caller is the demo admin of one shared
workspace, and data lives in memory until the process exits.

## 2. Choose persistence

With no persistence variables the store is in memory, per process. That is fine
for a demo and wrong for anything shared or running more than one instance.

### Plain Postgres

```bash
DATABASE_URL=postgres://<user>:<password>@<host>:5432/kages npm run db:setup
```

`db:setup` creates the database if it is missing and applies
`supabase/migrations/*.sql` in order, recording each file in `schema_migrations`,
so re-running it is safe. `DATABASE_URL` takes precedence over the Supabase
variables when both are set.

### Supabase

Set the server-only variables:

```bash
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role key>   # bypasses RLS; never expose to the browser
```

Apply the migrations with the Supabase CLI (`supabase db push`), or point
`npm run db:setup` at the project's direct Postgres connection string.

Apply new migrations before starting a new release. Storage fails closed when
the database is unreachable rather than serving stale or empty data.

## 3. Configure identity

A **built** app (`npm run build && npm start`) with no auth configured runs
**closed**: anyone can read public pages and nobody can write. That is deliberate.
A deployment that loses a variable degrades to read-only, never to an open admin.

`KAGES_LOCAL_MODE=1` makes a built app behave like `next dev`. Use it only on a
machine you alone can reach. **Never set it on a shared or public host**: every
visitor becomes an admin.

### Supabase Auth with Google

1. In Google Cloud, create an OAuth client (Web application) with the authorized
   redirect URI `https://<project>.supabase.co/auth/v1/callback`.
2. In Supabase → Authentication → Providers, enable Google with that client ID and
   secret.
3. In Supabase → Authentication → URL Configuration, set **Site URL** to your app's
   origin and add `https://<your-host>/auth/callback` to **Redirect URLs**.
4. Set the public variables:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```

Each signed-in user gets their own workspace on first login.

`NEXT_PUBLIC_*` values are **inlined into the browser bundle at build time**. They
must be present when `npm run build` runs, and changing them means rebuilding.
The server-only variables (`DATABASE_URL`, `SUPABASE_URL`,
`SUPABASE_SERVICE_ROLE_KEY`) are read at runtime.

## 4. Build and run

```bash
npm ci
npm run build
npm start          # honours PORT; put a TLS-terminating proxy in front
```

On Vercel, import the repository and set the same variables in the project
settings. Any Node host that runs `next start` works.

Keep old files under `public/` when you redeploy. Stored versions pin the renderer
and design-system assets by hash, so deleting old bundles breaks older versions.

## 5. Check it

- Sign in through `/login` and confirm you land in your own workspace.
- Send a write without a session, for example
  `curl -s -X POST https://<your-host>/api/create_kage -H 'content-type: application/json' -d '{}'`.
  It must be refused. If it succeeds, auth is not configured as you think.
- Restart the server and confirm your data is still there.

## Pointing the CLI and plugins at your instance

The published CLI and plugins default to the hosted service. To use your own:

```bash
npm run build:cli                                        # dist/kages.mjs
node dist/kages.mjs auth login --url https://<your-host>
KAGES_PLUGIN_MCP_URL=https://<your-host>/api/mcp npm run build:plugins
```

`kages push` and the MCP endpoint take a bearer token (`--token` or
`KAGES_TOKEN`) rather than the browser session.

## Keep operational data out of the repository

Populated `.env` files, service keys, database backups and exports, and
screenshots of admin consoles belong outside the checkout, not merely in an
ignored file inside it. `.env.example` lists every variable with placeholders.
