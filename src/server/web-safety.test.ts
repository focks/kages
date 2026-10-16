import { test } from "node:test";
import assert from "node:assert/strict";
import { safeNext, crossSiteWrite } from "./web-safety.ts";

const O = "https://kages.example";

test("safeNext follows local paths only", () => {
  assert.equal(safeNext("/artifacts?id=x#top", O), `${O}/artifacts?id=x#top`);
  assert.equal(safeNext("/", O), `${O}/`);
  assert.equal(safeNext("/a/b%20c", O), `${O}/a/b%20c`);
  for (const [bad, why] of [
    ["@attacker.example/path", "the reported case: ${origin}${next} would put the attacker after the @"],
    [".attacker.example", "text appended to the origin's host"], ["//attacker.example/x", "protocol-relative"], ["/\\attacker.example", "backslash is a slash to browsers"],
    ["https://attacker.example", "absolute"], ["javascript:alert(1)", "script scheme"], ["/\n/attacker.example", "control characters"], ["\\\\attacker.example", "backslashes"],
    ["", "empty"], [null, "missing"], [undefined, "missing"], ["artifacts", "not rooted"], ["/%2f%2fattacker.example", "encoded slashes stay a path and are fine only because they stay on the origin"],
  ] as [string | null | undefined, string][]) {
    const r = new URL(safeNext(bad, O));
    assert.equal(r.origin, O, `${String(bad)}: ${why}`);
  }
  assert.equal(safeNext("@attacker.example/path", O), `${O}/`);
  assert.equal(safeNext("//attacker.example", O), `${O}/`);
});

const req = (method: string, headers: Record<string, string> = {}) => ({ method, url: `${O}/api/delete_kage`, headers: { get: (n: string) => headers[n.toLowerCase()] ?? null } });
test("crossSiteWrite: only this app's own pages, or a bearer token, may change state", () => {
  assert.equal(crossSiteWrite(req("POST", { "sec-fetch-site": "same-origin", origin: O })), false);
  assert.equal(crossSiteWrite(req("POST", { "sec-fetch-site": "none" })), false, "a user typing the URL or a bookmark");
  assert.equal(crossSiteWrite(req("POST", { "sec-fetch-site": "cross-site", origin: "https://evil.test" })), true);
  assert.equal(crossSiteWrite(req("POST", { "sec-fetch-site": "same-site", origin: "https://evil.kages.example" })), true, "a sibling subdomain is not this app");
  assert.equal(crossSiteWrite(req("POST", { origin: "https://evil.test", host: "kages.example" })), true, "no Fetch Metadata: fall back to Origin");
  assert.equal(crossSiteWrite(req("POST", { origin: O, host: "kages.example" })), false);
  assert.equal(crossSiteWrite(req("POST", { origin: "null" })), true, "sandboxed frames");
  assert.equal(crossSiteWrite(req("POST", { origin: "https://kages.example", "x-forwarded-host": "kages.example", host: "internal:3000" })), false, "behind a proxy");
  assert.equal(crossSiteWrite(req("POST", { origin: "not a url", host: "kages.example" })), true);
  assert.equal(crossSiteWrite(req("POST")), false, "a CLI or curl sends neither header and carries no ambient cookie");
  assert.equal(crossSiteWrite(req("POST", { authorization: "Bearer abc", "sec-fetch-site": "cross-site" })), false, "a token is not forgeable cross-site");
  assert.equal(crossSiteWrite(req("POST", { authorization: "Basic abc", "sec-fetch-site": "cross-site" })), true);
  for (const m of ["GET", "HEAD", "OPTIONS", "get"]) assert.equal(crossSiteWrite(req(m, { "sec-fetch-site": "cross-site" })), false, `${m}: safe methods are left to the routes' own write check`);
  for (const m of ["PUT", "PATCH", "DELETE"]) assert.equal(crossSiteWrite(req(m, { "sec-fetch-site": "cross-site" })), true, m);
});
