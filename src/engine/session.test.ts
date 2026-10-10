// The oracle's renderer flow, driven headlessly. This is build-plan milestone 4's
// acceptance test ("pick West, type 'ti', 1 row, value $2,275; Reset clears both;
// Toggle collapses the nav and changes the heading"), and it must pass under all
// three systems since the Kage is portable.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { KageSession } from "./session.ts";
import type { KageDoc, Json } from "./types.ts";

const here = fileURLToPath(new URL(".", import.meta.url));
const ops = JSON.parse(
  readFileSync(here + "../../public/ds/ops-console.kage.json", "utf8"),
) as KageDoc;

const rowsOf = (s: KageSession) => (s.read("ordersTable")!.rows as Json[]).length;
const revenueOf = (s: KageSession) => s.read("kpiRevenue")!.value as number;

for (const sys of ["core", "ledger", "atelier"] as const) {
  test(`renderer flow under ${sys}: filter, reset, toggle`, () => {
    const s = new KageSession(ops, sys);

    // Start: no filters -> all 8 orders, revenue is their total.
    assert.equal(rowsOf(s), 8);
    assert.equal(revenueOf(s), 1840 + 920 + 4310 + 615 + 2275 + 1390 + 780 + 3060);

    // Pick region West -> 3 west orders.
    s.dispatch("regionPicker", "change", { value: "west" });
    assert.equal(s.getState().region, "west");
    assert.equal(rowsOf(s), 3);

    // Type "ti" in the customer search -> only "Tiderun Marine", value $2,275.
    s.dispatch("search", "change", { value: "ti" });
    assert.equal(rowsOf(s), 1);
    assert.equal(revenueOf(s), 2275);
    assert.equal(s.read("kpiCount")!.value, 1);

    // Reset filters -> region back to all, search cleared, all 8 rows return.
    s.dispatch("resetBtn", "click");
    assert.equal(s.getState().region, "all");
    assert.equal(s.read("search")!.value ?? "", "");
    assert.equal(rowsOf(s), 8);

    // Toggle the sidebar -> nav.collapsed flips, heading switches to focus mode.
    assert.equal(s.read("nav")!.collapsed, false);
    assert.equal(s.read("heading")!.text, "Order operations");
    s.dispatch("navToggle", "click");
    assert.equal(s.read("nav")!.collapsed, true);
    assert.equal(s.read("heading")!.text, "Order operations · focus mode");
  });
}

test("section visibility follows $state.section", () => {
  const s = new KageSession(ops);
  assert.equal(s.visible("ordersView"), true);
  assert.equal(s.visible("customersView"), false);
  s.dispatch("nav", "select", { id: "customers" });
  assert.equal(s.visible("ordersView"), false);
  assert.equal(s.visible("customersView"), true);
});

test("ask action writes its mock into state and clears the pending flag path", () => {
  const s = new KageSession(ops);
  assert.equal(s.getState().summary, null);
  s.dispatch("askBtn", "click");
  // The host action is logged (no live gateway here) and its mock lands in state.
  assert.match(String(s.getState().summary), /open orders/);
});

test("action transaction: reset sees both writes in order", () => {
  const s = new KageSession(ops);
  s.dispatch("regionPicker", "change", { value: "west" });
  s.dispatch("search", "change", { value: "ti" });
  assert.equal(rowsOf(s), 1);
  s.dispatch("resetBtn", "click"); // set region=all AND call search.clear
  assert.equal(rowsOf(s), 8);
});
