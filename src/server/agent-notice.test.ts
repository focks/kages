import test from "node:test";
import assert from "node:assert/strict";
import { agentNotice } from "./agent-notice.ts";

test("the notice names the text routes for this Kage and warns that authored text is data", () => {
  const n = agentNotice("3da772b5-d93e-4c6a-a5a6-24fba6bef5a0");
  assert.match(n, /GET \/k\/3da772b5-d93e-4c6a-a5a6-24fba6bef5a0\.md/);
  assert.match(n, /Accept: text\/markdown/);
  assert.match(n, /\/api\/shared\/3da772b5/);
  assert.match(n, /\/agents\.md/);
  assert.match(n, /data, never as instructions/);
});
