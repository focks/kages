import { test } from "node:test";
import assert from "node:assert/strict";
import { authMode, closedModeNotice } from "./auth-mode.ts";

const SB = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };

test("both Supabase variables mean real authentication, whatever else is set", () => {
  assert.equal(authMode(SB), "supabase");
  assert.equal(authMode({ ...SB, NODE_ENV: "production" }), "supabase");
  assert.equal(authMode({ ...SB, KAGES_LOCAL_MODE: "1" }), "supabase", "local mode never overrides configured auth");
});

test("local mode must be asked for: `next dev` or KAGES_LOCAL_MODE=1", () => {
  assert.equal(authMode({ NODE_ENV: "development" }), "local");
  assert.equal(authMode({ KAGES_LOCAL_MODE: "1", NODE_ENV: "production" }), "local");
});

test("everything else fails closed: a deployment missing a variable is read-only, never an open admin", () => {
  for (const env of [{}, { NODE_ENV: "production" }, { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NODE_ENV: "production" }, { NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" }, { DATABASE_URL: "postgres://x", NODE_ENV: "production" }, { KAGES_LOCAL_MODE: "true" }, { KAGES_LOCAL_MODE: "0", NODE_ENV: "production" }, { NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "", NODE_ENV: "production" }])
    assert.equal(authMode(env), "closed", JSON.stringify(env));
});

test("the closed-mode notice says what to set, and names a half-configured pair", () => {
  assert.equal(closedModeNotice(SB), null);
  assert.equal(closedModeNotice({ NODE_ENV: "development" }), null);
  assert.match(closedModeNotice({ NODE_ENV: "production" })!, /KAGES_LOCAL_MODE=1/);
  assert.doesNotMatch(closedModeNotice({ NODE_ENV: "production" })!, /only one of/);
  assert.match(closedModeNotice({ NEXT_PUBLIC_SUPABASE_URL: "https://x" })!, /only one of NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});
