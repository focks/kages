// The Mermaid compiler's promise: every relationship in the output exists in
// the input, cosmetics are dropped with a note, and unsupported semantics are
// thrown — never a silent partial import. These tests pin that promise.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mermaidToDiagram } from "./mermaid.ts";

test("a labelled LR chain compiles to a horizontal static diagram", () => {
  const r = mermaidToDiagram(`graph LR
    A[Agent] -->|doc| B[Engine]
    B -- valid --> C[Store]
    C --> D`);
  assert.equal(r.block.type, "diagram");
  assert.equal(r.block.props.layout, "horizontal");
  assert.deepEqual(r.block.props.nodes, [
    { id: "A", label: "Agent" }, { id: "B", label: "Engine" }, { id: "C", label: "Store" }, { id: "D", label: "D" },
  ]);
  assert.deepEqual(r.block.props.edges, [
    { from: "A", to: "B", label: "doc" }, { from: "B", to: "C", label: "valid" }, { from: "C", to: "D" },
  ]);
  assert.equal((r.block.props as Record<string, unknown>).interactive, undefined, "imports are static by default");
  assert.equal(r.stats.nodes, 4);
});

test("chains and & fans decompose into simple edges", () => {
  const r = mermaidToDiagram(`flowchart TD
    A --> B --> C
    A & B --> D`);
  assert.equal(r.block.props.layout, "vertical");
  assert.deepEqual(r.block.props.edges, [
    { from: "A", to: "B" }, { from: "B", to: "C" }, { from: "A", to: "D" }, { from: "B", to: "D" },
  ]);
});

test("subgraphs become groups; a node keeps the group it was first seen in", () => {
  const r = mermaidToDiagram(`graph TD
    subgraph ingest[Ingest layer]
      A[Reader] --> B[Parser]
    end
    subgraph Serve
      C[API]
    end
    B --> C`);
  const byId = Object.fromEntries(r.block.props.nodes.map((n) => [n.id, n]));
  assert.equal(byId.A.group, "Ingest layer");
  assert.equal(byId.B.group, "Ingest layer");
  assert.equal(byId.C.group, "Serve");
  assert.equal(r.stats.groups, 2);
});

test("shapes and markup are stripped to plain labels, and the notes say so", () => {
  const r = mermaidToDiagram(`graph LR
    A((Start)) --> B{"Big<br/>choice"}
    B --> C([Stadium])
    B --> D>Flag]`);
  const labels = r.block.props.nodes.map((n) => n.label);
  assert.deepEqual(labels, ["Start", "Big choice", "Stadium", "Flag"]);
  assert.ok(r.notes.some((n) => n.includes("shapes")), "shape note present");
});

test("a plain rectangle is not reported as a dropped shape", () => {
  const r = mermaidToDiagram(`graph LR
    A[One] --> B[Two]`);
  assert.ok(!r.notes.some((n) => n.includes("shapes")));
});

test("dotted, thick, undirected and x/o connectors survive with notes", () => {
  const r = mermaidToDiagram(`graph TD
    A -.-> B
    B ==> C
    C --- D
    D --o E`);
  assert.equal(r.block.props.edges.length, 4);
  assert.ok(r.notes.some((n) => n.includes("one weight")));
  assert.ok(r.notes.some((n) => n.includes("undirected")));
  assert.ok(r.notes.some((n) => n.includes("arrowheads dropped")));
});

test("cosmetic and click lines are dropped and counted, with one note per kind", () => {
  const r = mermaidToDiagram(`graph TD
    A --> B
    style A fill:#f9f
    classDef hot fill:#f00
    class B hot
    linkStyle 0 stroke:#0f0
    click A "https://example.com"`);
  assert.equal(r.stats.droppedLines, 5);
  assert.deepEqual(r.block.props.edges, [{ from: "A", to: "B" }]);
  assert.ok(r.notes.some((n) => n.startsWith("'style'")));
  assert.ok(r.notes.some((n) => n.startsWith("'class'")));
  assert.ok(r.notes.some((n) => n.includes("click bindings dropped")));
});

test("comments and semicolons are ignored; a bare header direction defaults to vertical", () => {
  const r = mermaidToDiagram(`%% a comment
graph
    A --> B;`);
  assert.equal(r.block.props.layout, "vertical");
  assert.deepEqual(r.block.props.edges, [{ from: "A", to: "B" }]);
});

test("other diagram kinds are rejected by name, with the alternative named", () => {
  assert.throws(() => mermaidToDiagram("sequenceDiagram\n  A->>B: hi"), /sequenceDiagram is not supported.*stepper/s);
  assert.throws(() => mermaidToDiagram("gantt\n  title x"), /gantt is not supported/);
  assert.throws(() => mermaidToDiagram("not mermaid at all"), /first line must be 'graph' or 'flowchart'/);
});

test("unsupported statements reject the whole import and name every offending line", () => {
  assert.throws(() => mermaidToDiagram(`graph TD
    A --> B
    ???
    !!!`), (e: Error) => e.message.includes("'???'") && e.message.includes("'!!!'") && e.message.startsWith("cannot compile"));
});

test("an unclosed subgraph, a stray end and empty input are rejected", () => {
  assert.throws(() => mermaidToDiagram("graph TD\n  subgraph S\n  A --> B"), /never closed/);
  assert.throws(() => mermaidToDiagram("graph TD\n  A --> B\n  end"), /'end' without a subgraph/);
  assert.throws(() => mermaidToDiagram("   "), /empty input/);
});

test("the renderer's bounds are enforced", () => {
  const big = "graph TD\n" + Array.from({ length: 201 }, (_, i) => `n${i}`).join("\n");
  assert.throws(() => mermaidToDiagram(big), /exceed the diagram bound of 200/);
});

test("graph limits are priced before fan expansion, not measured after it", () => {
  const ids = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`).join(" & ");
  assert.throws(() => mermaidToDiagram(`graph LR\n  ${ids("a", 30)} --> ${ids("b", 30)}`), /900 edges exceed the diagram bound of 400/);
  // the pathological shape: ~12KB of text, two unique nodes, millions of
  // would-be edges — must reject without constructing any of them
  const bomb = `graph LR\n  ${Array.from({ length: 1500 }, () => "A").join(" & ")} --> ${Array.from({ length: 1500 }, () => "B").join(" & ")}`;
  assert.throws(() => mermaidToDiagram(bomb), /exceed the diagram bound of 400/);
});

test("a hyphenated inline edge label stays a label, never an invented node", () => {
  const r = mermaidToDiagram("graph LR\n  A -- read-only --> B");
  assert.deepEqual(r.block.props.nodes.map((n) => n.id), ["A", "B"]);
  assert.deepEqual(r.block.props.edges, [{ from: "A", to: "B", label: "read-only" }]);
  // three link characters are a chain through a node, not a label opener
  const chain = mermaidToDiagram("graph LR\n  A --- B --> C");
  assert.deepEqual(chain.block.props.edges, [{ from: "A", to: "B" }, { from: "B", to: "C" }]);
  // a label the pipe form cannot carry rejects whole instead of becoming topology
  assert.throws(() => mermaidToDiagram("graph LR\n  A -- read|only --> B"), /cannot compile/);
});

test("semicolons separate statements instead of being swallowed into labels", () => {
  const r = mermaidToDiagram("graph LR\n  A[First]; B[Second]\n  C --> D[Third]; E[Fourth]");
  const byId = Object.fromEntries(r.block.props.nodes.map((n) => [n.id, n.label]));
  assert.deepEqual(byId, { A: "First", B: "Second", C: "C", D: "Third", E: "Fourth" });
  // a dropped cosmetic statement no longer takes its line-mates with it
  const s = mermaidToDiagram("graph TD\n  A --> B\n  style A fill:red; B --> C");
  assert.deepEqual(s.block.props.edges, [{ from: "A", to: "B" }, { from: "B", to: "C" }]);
  assert.equal(s.stats.droppedLines, 1);
  // quoted semicolons stay label text; trailing junk after a shape rejects
  assert.equal(mermaidToDiagram('graph LR\n  A["a;b"] --> B').block.props.nodes[0].label, "a;b");
  assert.throws(() => mermaidToDiagram("graph LR\n  A[x] B[y]"), /cannot compile/);
});

test("an edge to or from a subgraph boundary rejects the import in both declaration orders", () => {
  assert.throws(() => mermaidToDiagram("graph LR\n  subgraph S[Service]\n    A[Worker]\n  end\n  S --> B[Client]"), /'S' is a subgraph boundary/);
  assert.throws(() => mermaidToDiagram("graph LR\n  B --> S\n  subgraph S\n    A\n  end"), /'S' is a subgraph boundary/);
  // nodes inside the group are unaffected endpoints
  const ok = mermaidToDiagram("graph LR\n  subgraph S[Service]\n    A\n  end\n  A --> B");
  assert.equal(ok.stats.groups, 1);
  assert.deepEqual(ok.block.props.edges, [{ from: "A", to: "B" }]);
});

test("comparison text in labels survives; only recognised markup is stripped", () => {
  const r = mermaidToDiagram(`graph LR\n  A["0 < x > 0"] --> B["<b>bold</b><br/>line"]`);
  const byId = Object.fromEntries(r.block.props.nodes.map((n) => [n.id, n.label]));
  assert.equal(byId.A, "0 < x > 0");
  assert.equal(byId.B, "bold line");
});

test("same text, same block — and the static-first note always closes the notes", () => {
  const text = "graph LR\n  A[One] --> B[Two]\n  B --> C";
  const a = mermaidToDiagram(text), b = mermaidToDiagram(text);
  assert.deepEqual(a, b);
  assert.ok(a.notes[a.notes.length - 1].includes("graph-interaction-levels"));
  assert.equal(a.block.props.label, "Imported from Mermaid");
  assert.equal(mermaidToDiagram(text, { label: "Pipeline" }).block.props.label, "Pipeline");
});
