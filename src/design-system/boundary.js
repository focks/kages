/* System boundaries need stable spatial relationships, heterogeneous content and
 * named child endpoints. A separate role preserves every existing diagram's
 * placement. Only trusted renderer code builds SVG; document strings stay text.
 * See oracle/boundary.feature. */
  function CoreBoundaryDiagram(p) {
    var errors = boundaryFindings(p);
    if (errors.length) return h("div", { className: "kg-boundary__error", role: "alert" }, "Invalid boundary diagram: " + errors.map(function (e) { return e.msg; }).join("; "));
    var boxes = Object.create(null);
    function index(r, x, y) {
      boxes[r.id] = { x: x + r.x, y: y + r.y, width: r.width, height: r.height };
      (r.children || []).forEach(function (c) { index(c, x + r.x, y + r.y); });
    }
    (p.zones || []).concat(p.cards).forEach(function (r) { index(r, 0, 0); });
    function dash(style) { return style === "dashed" ? "8 6" : style === "dotted" ? "3 5" : undefined; }
    function point(id, side, port) {
      var b = boxes[id], t = port === undefined ? .5 : port;
      return side === "left" ? [b.x, b.y + b.height * t] : side === "right" ? [b.x + b.width, b.y + b.height * t] : side === "top" ? [b.x + b.width * t, b.y] : [b.x + b.width * t, b.y + b.height];
    }
    function arrow(tip, prev, key) {
      var dx = tip[0] - prev[0], dy = tip[1] - prev[1], length = Math.sqrt(dx * dx + dy * dy);
      if (!length) return null;
      dx /= length; dy /= length;
      return h("polygon", { key: key, points: tip.join(",") + " " + [tip[0] - dx * 19 - dy * 9, tip[1] - dy * 19 + dx * 9].join(",") + " " + [tip[0] - dx * 19 + dy * 9, tip[1] - dy * 19 - dx * 9].join(","), fill: "currentColor" });
    }
    function card(r, nested, zone) {
      return h("g", { key: r.id, transform: "translate(" + r.x + " " + r.y + ")", className: "kg-boundary__" + (zone ? "zone" : nested ? "cell" : "card") + (r.outline ? " kg-boundary__outline-" + r.outline : "") + " kg-palette-" + regionPalette(r.palette) },
        h("rect", { width: r.width, height: r.height, strokeDasharray: zone ? ((r.style === undefined || r.style === "dashed") ? "8 7" : dash(r.style)) : r.style === "dashed" ? "4 4" : dash(r.style) }),
        r.label ? h("text", { x: 16, y: 24, className: "kg-boundary__zone-label" }, r.label) : null,
        r.title ? h("text", { x: 20, y: 33, className: "kg-boundary__title" }, r.title) : null,
        r.subtitle ? h("text", { x: 20, y: 59, className: "kg-boundary__mono" }, r.subtitle) : null,
        (r.rules || []).map(function (y, i) { return h("line", { key: "r" + i, x1: 20, x2: r.width - 20, y1: y, y2: y, className: "kg-boundary__rule" }); }),
        (r.lines || []).map(function (line, i) { return h("text", { key: "l" + i, x: line.x === undefined ? (nested ? 14 : 20) : line.x, y: line.y, className: (line.font === "sans" ? "kg-boundary__sans" : "kg-boundary__mono") + (line.emphasis === "accent" ? " kg-boundary__line--accent" : "") }, line.text); }),
        (r.children || []).map(function (child) { return card(child, true, false); }));
    }
    var routes = (p.edges || []).map(function (e, i) {
      var pts = [point(e.from, e.fromSide, e.fromPort)].concat(e.via || [], [point(e.to, e.toSide, e.toPort)]), arrows = e.arrows || "end";
      return h("g", { key: i, className: "kg-boundary__edge kg-palette-" + regionPalette(e.palette) },
        h("polyline", { points: pts.map(function (pt) { return pt.join(","); }).join(" "), fill: "none", stroke: "currentColor", strokeWidth: 2.5, strokeDasharray: dash(e.style) }),
        arrows !== "none" ? arrow(pts[pts.length - 1], pts[pts.length - 2], "end") : null,
        arrows === "both" ? arrow(pts[0], pts[1], "start") : null);
    });
    return h("figure", { className: "kg-boundary", "aria-label": p.label },
      h("div", { className: "kg-boundary__viewport", tabIndex: 0, role: "region", "aria-label": p.label + "; scroll to inspect the full drawing" },
        h("svg", { viewBox: "0 0 " + p.width + " " + p.height, style: { width: p.width, minWidth: p.width }, "aria-label": p.label, role: "group" },
          h("title", null, p.label), h("rect", { width: p.width, height: p.height, className: "kg-boundary__ground" }),
          (p.zones || []).map(function (z) { return card(z, false, true); }), p.cards.map(function (r) { return card(r, false, false); }), routes,
          (p.edges || []).map(function (e, i) { return e.label ? h("text", { key: i, x: e.labelX, y: e.labelY, className: "kg-boundary__edge-label kg-palette-" + regionPalette(e.palette) }, e.label) : null; }))),
      p.caption ? h("figcaption", null, p.caption) : null);
  }
  // A bounded recursive schema exposes the same four child levels that the
  // validator supports, without an unbounded JSON-schema reference or markup.
  var BOUNDARY_LINE = S("object", { requiredKeys: ["text", "y"], properties: { text: S("string"), y: S("number", { description: "Baseline in parent-relative canvas units" }), x: S("number"), font: S("string", { enum: ["mono", "sans"] }), emphasis: S("string", { enum: ["normal", "accent"], description: "Explicit semantic accent; normal text is never inferred from position" }) } });
  function boundaryRectangleSpec(depth) {
    var properties = { id: S("string"), x: S("number"), y: S("number"), width: S("number"), height: S("number"), label: S("string"), title: S("string"), subtitle: S("string"), lines: S("array", { items: BOUNDARY_LINE }), rules: S("array", { items: S("number") }), style: S("string", { enum: ["solid", "dashed", "dotted"] }), outline: S("string", { enum: ["muted", "strong"] }), palette: S("string", { enum: REGION_PALETTES }) };
    if (depth) properties.children = S("array", { items: boundaryRectangleSpec(depth - 1), description: "Child rectangles use coordinates relative to this rectangle" });
    return S("object", { requiredKeys: ["id", "x", "y", "width", "height"], properties: properties });
  }
  var BOUNDARY_EDGE = S("object", { requiredKeys: ["from", "to", "fromSide", "toSide"], properties: { from: S("string"), to: S("string"), fromSide: S("string", { enum: ["left", "right", "top", "bottom"] }), toSide: S("string", { enum: ["left", "right", "top", "bottom"] }), fromPort: S("number"), toPort: S("number"), via: S("array", { items: S("array", { items: S("number") }), description: "Canvas-coordinate [x,y] waypoints; consecutive route points must differ" }), style: S("string", { enum: ["solid", "dashed", "dotted"] }), palette: S("string", { enum: REGION_PALETTES }), arrows: S("string", { enum: ["none", "end", "both"] }), label: S("string"), labelX: S("number"), labelY: S("number") } });
  interfaces["kages/boundary-diagram@1"] = {
    role: "boundary-diagram", summary: "Authored system boundaries with nested cards, selectable text and routed child endpoints.",
    props: { label: S("string", { required: true }), width: S("number", { required: true }), height: S("number", { required: true }), zones: S("array", { items: boundaryRectangleSpec(4) }), cards: S("array", { required: true, items: boundaryRectangleSpec(4) }), edges: S("array", { items: BOUNDARY_EDGE }), caption: S("string") }, slots: {}, events: {}, outputs: []
  };
  core["boundary-diagram"] = contract("core", "boundary-diagram", "1.0.0", "kages/boundary-diagram@1", CoreBoundaryDiagram, {
    tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "line-control", "accent", "wire", "accent-soft", "focus"],
    agent: { use: "Use when spatial boundaries, heterogeneous cards and nested endpoints carry meaning; use diagram for auto layout. Static only. width/height are canvas units (100..20000). zones/cards: {id,x,y,width,height,label?,title?,subtitle?,lines?:[{text,y,x?,font?:mono|sans,emphasis?:normal|accent}],rules?:[y],children?:[same rectangle],style?:solid|dashed|dotted,outline?:muted|strong,palette?:inherit|ocean|mint|violet|amber|rose}. Children use parent-relative coordinates; globally unique IDs, at most four child levels and 2000 rectangles total. At least one zone or card is required. Sibling and non-nested cards/cells must not overlap; zones are exempt. Keep text clear of later child rectangles. Card title baseline 33, subtitle 59, inset 20; cell inset 14. zones default to dashed outlines and uppercase mono labels; style overrides the outline. Unknown nested keys and zero-length route segments are errors. Use per-line emphasis:accent only where meaningful. edges: {from,to,fromSide,toSide,fromPort?,toPort?,via?:[[x,y]],style?,palette?,arrows?:none|end|both,label?,labelX?,labelY?}. Sides left/right/top/bottom, ports 0..1 along the side (default .5); via and label positions are canvas coordinates. Route orthogonally through gutters. Every endpoint must exist, including children. Text is literal, never HTML/SVG markup. Match line baselines and card dimensions to the content; no truncation. Phone uses contained keyboard-accessible horizontal scroll at original text size. Example: reference/examples/system-boundary-example.kage.json in the full example library. The technical palette applies only without a workspace design; pinned workspace colours take precedence." }
  });
  Object.assign(freeFlowExports, { CoreBoundaryDiagram: CoreBoundaryDiagram });
