// The persistence modules say tests and scripts may set the environment after loading them, so the
// Supabase settings must be read per call, as DATABASE_URL already is. Kept in its own file because
// persistence-rest.test.ts sets them BEFORE importing and so cannot observe the difference.
import { test, after } from "node:test";
import assert from "node:assert/strict";

const previous = { base: process.env.SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY, db: process.env.DATABASE_URL };
delete process.env.SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; delete process.env.DATABASE_URL;
const { persistenceEnabled } = await import("./persistence.ts");
const { sharesEnabled } = await import("./public-shares.ts");
after(() => { for (const [k, v] of [["SUPABASE_URL", previous.base], ["SUPABASE_SERVICE_ROLE_KEY", previous.key], ["DATABASE_URL", previous.db]]) if (v === undefined) delete process.env[k!]; else process.env[k!] = v; });

test("Supabase settings exported after the modules were imported are honoured", () => {
  assert.equal(persistenceEnabled(), false);
  assert.equal(sharesEnabled(), false);
  process.env.SUPABASE_URL = "https://late.invalid"; process.env.SUPABASE_SERVICE_ROLE_KEY = "late";
  assert.equal(persistenceEnabled(), true, "persistence sees variables set late");
  assert.equal(sharesEnabled(), true, "shares see variables set late");
});
