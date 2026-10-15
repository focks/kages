// Create the Kages database (if missing) and apply supabase/migrations/*.sql to
// it, so a plain local Postgres can back the app with no Supabase involved.
//   DATABASE_URL=postgres:///kages_dev?host=/var/run/postgresql node scripts/db-setup.mjs
// Migrations are the same files Supabase uses; their `enable row level security`
// lines are harmless on plain Postgres (the owner bypasses RLS). Applied files
// are recorded in schema_migrations so re-running is a no-op.
import { readdirSync, readFileSync } from "node:fs";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const target = new URL(url);
const dbName = decodeURIComponent(target.pathname.replace(/^\//, ""));
if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(dbName)) { console.error("database name must be a plain identifier, got: " + dbName); process.exit(1); }

// CREATE DATABASE cannot run inside the target database, so connect to the
// maintenance database on the same server first.
const admin = new URL(url); admin.pathname = "/postgres";
const a = new pg.Client({ connectionString: admin.toString() });
await a.connect();
const exists = await a.query("select 1 from pg_database where datname = $1", [dbName]);
if (!exists.rowCount) { // template0 + C.UTF-8 on purpose: template1 can carry a stale glibc collation
// version after an OS upgrade, which makes `create database` refuse to run, and
// refreshing it would alter shared server state. C.UTF-8 has no version to go stale.
  await a.query(`create database ${dbName} template template0 encoding 'UTF8' locale 'C.UTF-8'`); console.log("created database " + dbName); } else console.log("database " + dbName + " exists");
await a.end();

const c = new pg.Client({ connectionString: url });
await c.connect();
await c.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
for (const file of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
  if ((await c.query("select 1 from schema_migrations where name = $1", [file])).rowCount) { console.log("  skip  " + file); continue; }
  await c.query("begin");
  try { await c.query(readFileSync("supabase/migrations/" + file, "utf8")); await c.query("insert into schema_migrations (name) values ($1)", [file]); await c.query("commit"); console.log("  apply " + file); }
  catch (e) { await c.query("rollback"); console.error("failed " + file + ": " + e.message); process.exit(1); }
}
await c.end();
