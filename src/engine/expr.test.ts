import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluate, getPath, operatorOf } from "./expr.ts";
import type { EvalContext, Json } from "./types.ts";

const orders: Json = [
  { id: "A-1041", customer: "Halden Supply", region: "north", status: "open", total: 1840 },
  { id: "A-1042", customer: "Tide Freight", region: "west", status: "open", total: 2275 },
  { id: "A-1043", customer: "Northwind", region: "west", status: "closed", total: 900 },
];

/** Build a context where $block/$self resolve from a plain outputs map. */
function ctx(over: Partial<EvalContext> & { outputs?: Record<string, Record<string, Json>> } = {}): EvalContext {
  const outputs = over.outputs ?? {};
  return { state: over.state, data: over.data, event: over.event, item: over.item, self: over.self, output: (id) => outputs[id] };
}

test("$state / $data / $self / $event / $item read dot paths", () => {
  assert.equal(evaluate({ $state: "filters.region" }, ctx({ state: { filters: { region: "north" } } })), "north");
  assert.deepEqual(evaluate({ $data: "orders" }, ctx({ data: { orders } })), orders);
  assert.equal(evaluate({ $self: "collapsed" }, ctx({ self: "nav", outputs: { nav: { collapsed: true } } })), true);
  assert.equal(evaluate({ $event: "value" }, ctx({ event: { value: "x" } })), "x");
  assert.equal(evaluate({ $item: "name" }, ctx({ item: { name: "n" } })), "n");
});

test("$block reads a block output by id.key", () => {
  assert.deepEqual(evaluate({ $block: "ordersTable.rows" }, ctx({ outputs: { ordersTable: { rows: orders } } })), orders);
});

test("missing lookups return undefined (reference semantics)", () => {
  assert.equal(evaluate({ $state: "nope" }, ctx({ state: {} })), undefined);
  assert.equal(evaluate({ $block: "ghost.rows" }, ctx({})), undefined);
});

test("boolean, equality and conditional operators", () => {
  assert.equal(evaluate({ $not: false }, ctx()), true);
  assert.equal(evaluate({ $and: [true, true] }, ctx()), true);
  assert.equal(evaluate({ $or: [false, true] }, ctx()), true);
  assert.equal(evaluate({ $eq: ["a", "a"] }, ctx()), true);
  assert.equal(evaluate({ $eq: [1, "1"] }, ctx()), false, "strict equality");
  assert.equal(evaluate({ $neq: ["a", "b"] }, ctx()), true);
  assert.equal(evaluate({ $if: [true, "yes", "no"] }, ctx()), "yes");
  assert.equal(evaluate({ $if: [false, "yes", "no"] }, ctx()), "no");
});

test("$tpl fills holes and JSON-stringifies objects", () => {
  const c = ctx({ state: { region: "west" }, outputs: { nav: { value: "orders" } } });
  assert.equal(evaluate({ $tpl: "Region: {{state.region}} · {{block.nav.value}}" }, c), "Region: west · orders");
  assert.equal(evaluate({ $tpl: "rows={{state.rows}}" }, ctx({ state: { rows: [1, 2] } })), "rows=[1,2]");
});

test("$filter by field equality, with skipIf", () => {
  assert.deepEqual(
    evaluate({ $filter: { list: { $data: "orders" }, field: "region", equals: "west" } }, ctx({ data: { orders } })),
    [orders[1], orders[2]],
  );
  assert.deepEqual(
    evaluate({ $filter: { list: { $data: "orders" }, field: "region", equals: "all", skipIf: "all" } }, ctx({ data: { orders } })),
    orders,
  );
});

test("$filter contains over several fields, case-insensitive", () => {
  const got = evaluate(
    { $filter: { list: { $data: "orders" }, contains: "ti", fields: ["customer", "id"] } },
    ctx({ data: { orders } }),
  ) as Json[];
  assert.deepEqual(got, [orders[1]], 'only "Tide Freight" matches "ti"');
});

test("$count, $sum, $find, $map", () => {
  assert.equal(evaluate({ $count: { $data: "orders" } }, ctx({ data: { orders } })), 3);
  assert.equal(evaluate({ $sum: [{ $data: "orders" }, "total"] }, ctx({ data: { orders } })), 1840 + 2275 + 900);
  assert.deepEqual(evaluate({ $find: { list: { $data: "orders" }, field: "id", equals: "A-1042" } }, ctx({ data: { orders } })), orders[1]);
  assert.equal(evaluate({ $find: { list: { $data: "orders" }, field: "id", equals: "zzz" } }, ctx({ data: { orders } })), null);
  assert.deepEqual(
    evaluate({ $map: { list: { $data: "regions" }, to: { value: { $item: "id" }, label: { $item: "name" } } } }, ctx({ data: { regions: [{ id: "n", name: "North" }] } })),
    [{ value: "n", label: "North" }],
  );
});

test("the oracle renderer chain: filter West + 'ti' -> 1 row, revenue 2275", () => {
  const region = evaluate(
    { $filter: { list: { $data: "orders" }, field: "region", equals: { $state: "region" }, skipIf: "all" } },
    ctx({ data: { orders }, state: { region: "west" } }),
  ) as Json[];
  const rows = evaluate(
    { $filter: { list: region, contains: { $state: "q" }, fields: ["customer", "id"] } },
    ctx({ state: { q: "ti" } }),
  ) as Json[];
  assert.equal(rows.length, 1);
  assert.equal(evaluate({ $sum: [rows, "total"] }, ctx()), 2275);
});

test("literals walk recursively and evaluate nested expressions", () => {
  assert.deepEqual(
    evaluate({ a: 1, b: { $state: "x" }, c: [{ $state: "y" }] }, ctx({ state: { x: 2, y: 3 } })),
    { a: 1, b: 2, c: [3] },
  );
});

test("the operator set is closed", () => {
  assert.equal(operatorOf({ $js: "window" } as Json), null, "$js is not an operator");
  assert.deepEqual(evaluate({ $js: "window" } as Json, ctx()), { $js: "window" });
});

test("getPath refuses prototype keys and never reaches the prototype chain", () => {
  assert.equal(getPath({}, "__proto__"), undefined);
  assert.equal(getPath({}, "constructor"), undefined);
  assert.equal(getPath({ a: { b: 1 } }, "a.prototype"), undefined);
  assert.equal(getPath({ a: { b: 1 } }, "a.b"), 1);
});

test("evaluate is pure: repeated calls match and do not mutate inputs", () => {
  const c = ctx({ data: { orders } });
  const e = { $filter: { list: { $data: "orders" }, field: "status", equals: "open" } } as Json;
  assert.deepEqual(evaluate(e, c), evaluate(e, c));
});
