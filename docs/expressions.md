# Expressions and data

A Kage is interactive because blocks read and write a small amount of state through expressions. An expression is plain JSON, the operator set is closed, and nothing is ever run as code, so an agent can author behaviour without writing a program.

## The expression model

An expression is a JSON value. If it is an object whose first key is a known operator, it is evaluated; otherwise every value is a literal. Expressions nest, and evaluation only ever reads data — there is no `eval`, no function call, and no way to reach the host page.

```json
{ "$add": [ { "$state": "price" }, { "$state": "tax" } ] }
```

Reads walk object paths by own keys only, so `__proto__`, `constructor` and `prototype` never resolve. When a value from your data happens to look like an operator, wrap it in `$literal` to keep it opaque:

```json
{ "$literal": { "$state": "this is data, not an expression" } }
```

Arithmetic that has no answer — divide by zero, overflow, a non-finite result — evaluates to `null` rather than `NaN`, so a bad number can never poison state. Formatting is pinned to the `en-US` locale and `UTC`, so a page renders the same on every machine.

## Reading data

Each operator takes a dot path and returns a value from one source.

| Operator | Reads |
|----------|-------|
| `$state` | A declared state key |
| `$data` | The document's `data` block |
| `$block` | Another block's output, `"id"` or `"id.output"` |
| `$self` | An output of the current block |
| `$event` | A field of the event that fired a handler |
| `$item` | The current repeat row (empty path is the whole row) |
| `$index` | The current repeat position, 0-based |
| `$scope` | A field of an enclosing repeat's row, by alias |
| `$input` | An input of the current composition |

## Text

`$tpl` fills `{{namespace.path}}` holes from state, data, the current block, item and input; a missing key collapses to an empty string. `$concat` joins its arguments as strings.

```json
{ "$tpl": "{{item.name}} — {{data.currency}}{{item.price}}" }
```

## Logic and numbers

Comparisons (`$eq`, `$neq`, `$lt`, `$lte`, `$gt`, `$gte`) and booleans (`$and`, `$or`, `$not`, `$if`) build conditions. Arithmetic (`$add`, `$sub`, `$mul`, `$div`, `$mod`, `$pow`, `$min`, `$max`, `$round`, and the one-value `$floor`, `$ceil` and `$abs`, each written `[value]`) does the sums; any invalid result is `null`.

```json
{ "$if": [ { "$gt": [ { "$state": "count" }, 0 ] }, "In stock", "Sold out" ] }
```

## Lists

These shape arrays before a `table`, a chart or a repeat reads them.

| Operator | Does |
|----------|------|
| `$count` | Length of a list |
| `$sum` | Sum of a field across a list |
| `$find` | First row where a field equals a value, else null |
| `$filter` | Keep rows matching `equals` or a `contains` search; `skipIf` disables the test for an "all" option |
| `$map` | Transform each row with a `to` expression |
| `$sort` | Stable sort by a field, `asc` or `desc` |

```json
{ "$filter": { "list": { "$data": "orders" }, "field": "region",
  "equals": { "$state": "region" }, "skipIf": "all" } }
```

## Joining and cutting text

`$join` writes a list as one string; `$truncate` keeps the first `length` characters and adds a `suffix` when it cut something.

```json
{ "$join": { "list": { "$item": "tags" }, "separator": " · " } }
{ "$truncate": { "value": { "$item": "summary" }, "length": 80, "suffix": "…" } }
```

## Formatting

`$format` renders a number as plain, currency or percent, or a date, to a chosen number of digits. `notation: "compact"` writes 1,234,567 as 1.2M. A relative date needs the moment to compare with, written `relativeTo`, because a page must read the same on every render: `style: "relative"` gives "3d ago" or "5h from now".

```json
{ "$format": { "value": { "$item": "price" }, "style": "currency", "currency": "USD", "digits": 2 } }
```

## Bindings and events

A block reads values through `bind`, declares shared keys in `state`, and responds to events through `on`. Binding is one-way: the expression evaluates and the renderer shows the result. An event handler runs as one transaction — if anything in it fails, state is left untouched.

```json
{
  "state": { "query": "" },
  "blocks": {
    "search": { "type": "text-field", "props": { "label": "Filter" },
      "bind": { "value": { "$state": "query" } },
      "on": { "change": [ { "do": "set", "path": "query", "value": { "$event": "value" } } ] } },
    "echo": { "type": "text", "bind": { "text": { "$tpl": "Searching: {{state.query}}" } } }
  }
}
```

## Reacting to a change

A block can declare `watch`: a state path and the actions to run after any transaction that changed that path's value. Writing an equal value does not count as a change. Watchers run on the same transaction, up to four passes, and a handler that keeps changing what it watches is stopped and reported in the log.

```json
{ "type": "text", "props": { "text": "" },
  "watch": { "cart": [ { "do": "set", "path": "dirty", "value": true } ] } }
```

## Repeats

A block with `repeat` renders once per row of a list. `each` is the list, `as` names the row for nested scopes, and `key` is a stable id — a string or number path into the row. With a key, a row's local state (an open panel, a typed note) follows the row through filtering and sorting; without one, identity is positional and resets when the order changes. Repeats expand to at most 10,000 blocks, and duplicate keys are rejected when the Kage is validated.

```json
{ "type": "card", "repeat": { "each": { "$data": "products" }, "key": "id", "as": "product" },
  "bind": { "title": { "$item": "name" } } }
```

A handler inside a repeat can write to its own row: `set` and `toggle` take a `path` that is an expression, for example `{ "$concat": ["todos.", { "$index": "" }, ".done"] }`. Inside a repeat, `$item` is the current row and `$index` its position; a nested repeat reads its parent's row with `$scope`, for example `{ "$scope": "product.name" }`.

## Compositions

A composition is a reusable block tree with typed inputs, defined once in `doc.compositions` and placed with a `composition` block. The definition reads its inputs with `$input`; the caller passes them through `props.inputs` or `bind.inputs` and reads the composition's declared output as `instance.value`. Inputs and the declared `outputType` are type-checked, and a composition cannot reference itself.

```json
{
  "compositions": {
    "money": { "inputs": { "amount": { "type": "number", "required": true } },
      "root": "n", "blocks": { "n": { "type": "text",
        "bind": { "text": { "$format": { "value": { "$input": "amount" }, "style": "currency" } } } } } }
  },
  "blocks": {
    "total": { "type": "composition", "props": { "name": "money" },
      "bind": { "inputs": { "amount": { "$sum": [ { "$data": "lines" }, "cost" ] } } } }
  }
}
```

To see the full set of block types these expressions drive, read [blocks](blocks.md). To understand where state and data sit in the document, read [concepts](concepts.md).
