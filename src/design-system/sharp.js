/* Refined contracts add composition without changing old pinned renderers.
 * Lead content precedes supporting controls in the DOM and on phones; desktop
 * supporting panes retain one instance of each block and its state. */
  function CoreCanvasV2(p) {
    var React = R(), controls = React.useState(false), personality = choice(p.personality, ["analytical", "editorial", "exploratory", "teaching", "showcase"], "analytical");
    var supported = (p.actions && p.actions.length) || (p.support && p.support.length);
    return h("div", { className: "kg-canvas kg-canvas--refined kg-canvas--" + personality + " kg-canvas--" + choice(p.density, ["comfortable", "compact"], "comfortable"), "data-appearance": choice(p.appearance, ["inherit", "light", "dark"], "inherit") },
      h("div", { className: "kg-canvas__inner" },
        p.title || p.eyebrow || p.description ? h("header", { className: "kg-canvas__header" }, p.eyebrow ? h("p", { className: "kg-canvas__eyebrow" }, p.eyebrow) : null, p.title ? h("h1", null, p.title) : null, p.description ? h("p", { className: "kg-canvas__description" }, p.description) : null) : null,
        supported ? h("button", { type: "button", className: "kg-canvas__controls-toggle", "aria-expanded": controls[0], onClick: function () { controls[1](!controls[0]); } }, controls[0] ? "Hide controls" : "Controls and details") : null,
        h("div", { className: "kg-canvas__workspace" + (supported ? " kg-canvas__workspace--supported" : "") },
          h("div", { className: "kg-canvas__lead" }, p.lead),
          supported ? h("aside", { className: "kg-canvas__support" + (controls[0] ? " is-open" : ""), "aria-label": "Controls and supporting detail" }, p.actions, p.support) : null),
        h("main", { className: "kg-canvas__content" }, p.children),
        p.footer && p.footer.length ? h("footer", { className: "kg-canvas__footer" }, p.footer) : null));
  }
  var canvasBase = contracts[core.canvas], canvasInterface = canvasBase.implements[0];
  interfaces[canvasInterface] = Object.assign({}, interfaces[canvasInterface], { slots: Object.assign({}, interfaces[canvasInterface].slots, { lead: {}, support: {} }) });
  core.canvas = contract("core", "canvas", "1.1.0", canvasInterface, CoreCanvasV2, { agent: { use: canvasBase.agent.use + " Put the primary chart or figure in lead. actions and support form a supporting pane on wide screens and a toggled controls region on phones, after the primary visual. children is supporting content. Editorial/showcase keep an open reading composition; analytical/exploratory/teaching use a two-pane work area. Avoid repeating a block in two slots." } });
  Object.keys(core).filter(function (name) { return /chart|box-plot|small-multiples|treemap|sankey|heatmap|gauge|sparkline/.test(name); }).forEach(function (name) {
    var previous = contracts[core[name]], impl = impls[previous.ref], iface = previous.implements[0];
    var props = { treatment: S("string", { enum: ["plain", "inset", "bordered"], default: "plain" }) };
    interfaces[iface] = Object.assign({}, interfaces[iface], { props: Object.assign({}, interfaces[iface].props, props) });
    if (name === "line-chart" || name === "area-chart" || name === "scatter-chart") {
      props.xTicks = S("string", { enum: ["auto", "integer"], default: "auto" });
      props.height = S("number", { min: 180, max: 480, default: 260 });
      interfaces[iface].props = Object.assign({}, interfaces[iface].props, props);
    }
    var version = previous.version.split(".");
    core[name] = contract("core", name, version[0] + "." + (Number(version[1]) + 1) + ".0", iface, function (p) { return h(impl, Object.assign({}, p, { __sharp: true })); }, { props: Object.assign({}, previous.props, props), tokens: previous.tokens, agent: { use: previous.agent.use + " treatment:plain removes container chrome; inset creates a quiet surface; bordered separates independently usable panels. Use xTicks:integer for ordinal numeric periods on Cartesian plots. height controls Cartesian plot height from 180 to 480px. Range controls are disclosed on demand." } });
  });
  function CoreGuideV2(p) { return h("div", { className: "kg-guide-refined" }, h(CoreGuide, p)); }
  var guideBase = contracts[core.guide];
  core.guide = contract("core", "guide", "1.1.0", guideBase.implements[0], CoreGuideV2, { props: guideBase.props, tokens: guideBase.tokens, agent: guideBase.agent });
  Object.assign(freeFlowExports, { CoreCanvasV2: CoreCanvasV2, CoreGuideV2: CoreGuideV2 });

  function CorePreciseDiagram(p) {
    var React = R(), element = React.useRef(null), size = React.useState(640);
    React.useEffect(function () { if (!element.current || !W.ResizeObserver) return; var observer = new W.ResizeObserver(function (entries) { size[1](entries[0].contentRect.width); }); observer.observe(element.current); return function () { observer.disconnect(); }; }, []);
    var seen = Object.create(null);
    var nodes = (Array.isArray(p.nodes) ? p.nodes : []).filter(function (n) { if (!n || typeof n.id !== "string" || seen[n.id]) return false; seen[n.id] = true; return true; }).slice(0, 200);
    if (nodes.some(function (n) { return typeof n.x === "number" || typeof n.y === "number"; })) return h(CoreDiagramV2, Object.assign({}, p, { __sharp: false }));
    var vertical = size[0] < 500 || p.layout === "vertical" || p.__layout === "tree", positions = Object.create(null), boxes = [], groups = [];
    var columns = vertical ? 1 : 2, height = 100, width = vertical ? 280 : 560;
    // Rank-based flow when it fits: a DAG whose layers fit the measured container
    // reads left-to-right in one pass, like a hand-drawn pipeline. The serpentine
    // two-column grid is the fallback for cycles and graphs wider than the box,
    // not the default — wrapping a four-step chain into 2×2 is what made these
    // diagrams read as a maze of rails instead of a flow.
    var edgeList = (Array.isArray(p.edges) ? p.edges : []).filter(function (e) { return e && e.from !== e.to; });
    var flowRanks = null, flowLanes = Object.create(null);
    if (!vertical && (!p.__layout || p.__layout === "auto" || p.__layout === "horizontal")) {
      var ranks = diagramLayers(nodes, edgeList.filter(function (e) { var ok = Object.create(null); nodes.forEach(function (n) { ok[n.id] = true; }); return ok[e.from] && ok[e.to]; }));
      if (ranks) {
        var layerCount = 0, laneCounts = Object.create(null);
        nodes.forEach(function (n) { layerCount = Math.max(layerCount, ranks[n.id] + 1); laneCounts[ranks[n.id]] = (laneCounts[ranks[n.id]] || 0) + 1; });
        // 260 is the node pitch; the measured width decides how many layers fit.
        var fits = layerCount <= Math.max(2, Math.floor((size[0] - 16) / 260));
        if (fits && layerCount > 1) { flowRanks = ranks; }
      }
    }
    nodes.forEach(function (n, i) {
      var row = Math.floor(i / columns), col = i % columns;
      if (flowRanks) { col = flowRanks[n.id]; row = flowLanes[col] || 0; flowLanes[col] = row + 1; }
      if (p.__layout === "sequence") { col = i; row = 0; }
      if (p.__layout === "swimlane" && !vertical) { if (groups.indexOf(n.group) < 0) groups.push(n.group); row = groups.indexOf(n.group); col = nodes.slice(0, i).filter(function (other) { return other.group === n.group; }).length; }
      var at = { x: 16 + col * 260, y: 16 + row * 132, w: 176, h: 64 };
      positions[n.id] = at; boxes.push(at); height = Math.max(height, at.y + 108); width = Math.max(width, at.x + 240);
    });
    var occupied = [], edges = (Array.isArray(p.edges) ? p.edges : []).filter(function (e) { return e && positions[e.from] && positions[e.to] && e.from !== e.to; }).slice(0, 400);
    var paths = edges.map(function (edge, i) {
      var a = positions[edge.from], b = positions[edge.to], offset = (i % 3 - 1) * 10, points;
      if (a.y === b.y && b.x > a.x) points = [[a.x + 176, a.y + 32 + offset], [b.x - 8, b.y + 32 + offset]];
      else if (a.x === b.x && b.y === a.y + 132) points = [[a.x + 88 + offset, a.y + 64], [b.x + 88 + offset, b.y - 8]];
      else {
        // Long and feedback links use separate exterior rails. Exit/entry legs
        // stay inside row gutters so no route passes through a node body.
        var rail = width - 36 + (i % 4) * 10, exit = a.y + 82 + (i % 3) * 8, enter = Math.max(4, b.y - 18 - (i % 2) * 8);
        points = [[a.x + 88 + offset, a.y + 64], [a.x + 88 + offset, exit], [rail, exit], [rail, enter], [b.x + 88 + offset, enter], [b.x + 88 + offset, b.y - 6]];
      }
      var last = points[points.length - 1], before = points[points.length - 2], dx = Math.sign(last[0] - before[0]), dy = Math.sign(last[1] - before[1]);
      var label = null, lines = diagramLines(edge.label || "", 20, 2);
      if (edge.label) {
        var segments = points.slice(1).map(function (pt, j) { return { a: points[j], b: pt, length: Math.abs(pt[0] - points[j][0]) + Math.abs(pt[1] - points[j][1]) }; }).sort(function (a, b) { return b.length - a.length; });
        segments.some(function (segment) {
          var x = (segment.a[0] + segment.b[0]) / 2, y = (segment.a[1] + segment.b[1]) / 2, w = Math.max.apply(null, lines.map(function (line) { return line.length * 6; })) + 12, hh = lines.length * 14 + 4, box = { x: x - w / 2, y: y - hh / 2, w: w, h: hh };
          function overlap(other) { return box.x < other.x + other.w + 3 && box.x + box.w > other.x - 3 && box.y < other.y + other.h + 3 && box.y + box.h > other.y - 3; }
          if (box.x < 0 || box.y < 0 || box.x + w > width || boxes.some(overlap) || occupied.some(overlap)) return false;
          occupied.push(box); label = h("g", null, h("rect", { x: box.x, y: box.y, width: w, height: hh, rx: 3, fill: "var(--kg-paper)" }), lines.map(function (line, n) { return h("text", { key: n, x: x, y: box.y + 12 + n * 14, textAnchor: "middle", fontSize: 11, fill: "var(--kg-ink-muted)" }, line); })); return true;
        });
      }
      return h("g", { key: i, opacity: Array.isArray(p.__connected) && (p.__connected.indexOf(edge.from) < 0 || p.__connected.indexOf(edge.to) < 0) ? .16 : 1 }, h("title", null, edge.from + " → " + edge.to + ": " + (edge.label || "Connected")), h("path", { d: points.map(function (pt, j) { return (j ? "L" : "M") + pt.join(" "); }).join(" "), fill: "none", stroke: "var(--kg-ink-muted)", strokeWidth: 1.25, strokeLinejoin: "round" }), h("polygon", { points: last.join(",") + " " + [last[0] - dx * 7 - dy * 3, last[1] - dy * 7 + dx * 3].join(",") + " " + [last[0] - dx * 7 + dy * 3, last[1] - dy * 7 - dx * 3].join(","), fill: "var(--kg-ink-muted)" }), label);
    });
    return h("figure", { ref: element, className: "kg-precise-diagram", "aria-label": p.label }, h("svg", { viewBox: "0 0 " + width + " " + height, style: { width: "100%", minWidth: Math.min(width, 280) }, role: "group", "aria-label": p.label }, paths, nodes.map(function (n) {
      var at = positions[n.id], selected = p.selected === n.id;
      function select() { fire(p.onSelect, { id: n.id }); }
      return h("g", { key: n.id, transform: "translate(" + at.x + " " + at.y + ")", className: "kg-diagram__node kg-palette-" + regionPalette(n.palette), role: p.interactive ? "button" : undefined, tabIndex: p.interactive ? 0 : undefined, "aria-label": String(n.label || n.id), "aria-pressed": p.interactive ? selected : undefined, opacity: p.__connected && p.__connected.indexOf(n.id) < 0 ? .3 : 1, onClick: p.interactive ? select : undefined, onKeyDown: function (event) { if (p.interactive && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); select(); } } }, h("rect", { width: 176, height: 64, rx: 6, fill: "var(--kg-surface)", stroke: selected ? "var(--kg-accent)" : "var(--kg-line-control)", strokeWidth: selected ? 2 : 1 }), h("rect", { x: 0, y: 12, width: 3, height: 40, rx: 1.5, fill: "var(--kg-accent)" }), h("text", { x: 14, y: 19, fontSize: 10, fill: "var(--kg-accent)" }, shortLabel(String(n.group || ""), 24)), diagramLines(n.label || n.id, 22, 2).map(function (line, i) { return h("text", { key: i, x: 14, y: 37 + i * 14, fontSize: 12, fontWeight: 600, fill: "var(--kg-ink)" }, line); }));
    })), p.caption ? h("figcaption", null, p.caption) : null);
  }
  var preciseBase = contracts[core.diagram];
  function CoreGraphExplorerV3(p) { return h(CoreGraphExplorer, Object.assign({}, p, { __route: true, __sharp: true })); }
  core.diagram = contract("core", "diagram", "1.5.0", preciseBase.implements[0], CoreGraphExplorerV3, { props: preciseBase.props, tokens: preciseBase.tokens, agent: { use: preciseBase.agent.use + " Compact nodes, separated ports and exterior feedback lanes keep the primary flow legible. Adaptive two-column/vertical layout preserves label size. Selection should reveal a concise supporting explanation." } });
  Object.assign(freeFlowExports, { CorePreciseDiagram: CorePreciseDiagram, CoreGraphExplorerV3: CoreGraphExplorerV3 });
