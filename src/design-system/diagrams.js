/* Directed diagrams use graph structure for placement and retain a vertical
 * rendering for narrow containers. Labels and whole-node keyboard targets stay
 * readable instead of shrinking a desktop drawing to a phone. Old diagram refs
 * keep their renderer; explicit coordinates still use that established path. */
  function diagramLines(value, limit, count) {
    var words = String(value == null ? "" : value).slice(0, 2000).split(/\s+/), lines = [""];
    words.forEach(function (word) {
      while (word.length > limit) { if (lines[lines.length - 1]) lines.push(""); lines[lines.length - 1] = word.slice(0, limit); word = word.slice(limit); lines.push(""); }
      var last = lines.length - 1;
      if ((lines[last] + " " + word).trim().length > limit) lines.push(word); else lines[last] = (lines[last] + " " + word).trim();
    });
    var result = lines.slice(0, count);
    if (lines.length > count) result[count - 1] = result[count - 1].slice(0, limit - 1) + "…";
    return result;
  }

  // Kahn's algorithm gives DAGs stable, longest-path layers. A cycle falls back
  // to a bounded grid without dropping nodes or hiding a relationship.
  function diagramLayers(nodes, edges) {
    var degree = Object.create(null), rank = Object.create(null), outgoing = Object.create(null);
    nodes.forEach(function (n) { degree[n.id] = 0; rank[n.id] = 0; outgoing[n.id] = []; });
    edges.forEach(function (e) { degree[e.to]++; outgoing[e.from].push(e.to); });
    var queue = nodes.filter(function (n) { return !degree[n.id]; }).map(function (n) { return n.id; }), visited = 0;
    while (visited < queue.length) {
      var id = queue[visited++];
      outgoing[id].forEach(function (to) { rank[to] = Math.max(rank[to], rank[id] + 1); if (--degree[to] === 0) queue.push(to); });
    }
    return visited === nodes.length ? rank : null;
  }

  // The layout uses a regular lattice. Route long/backward connections through
  // its gutters, never through intervening boxes. Offsets stay within each gap;
  // increasing edge count must not make the canvas grow without bound.
  function diagramRoute(a, b, vertical, index) {
    var forward = vertical ? b.y > a.y : b.x > a.x, same = vertical ? b.y === a.y : b.x === a.x;
    var lane = index % 3, points, sx, sy, ex, ey, rail;
    if (vertical) {
      sx = a.x + 104; ex = b.x + 104;
      sy = a.y + (forward || same ? 98 : -2); ey = b.y + (forward && !same ? -8 : 104);
      if (!same && a.x === b.x && Math.abs(b.y - a.y) === 184) points = [[sx, sy], [ex, ey]];
      else if (same) points = [[sx, sy], [sx, a.y + 128 + lane * 12], [ex, a.y + 128 + lane * 12], [ex, ey]];
      else {
        var startY = a.y + (forward ? 128 + lane * 12 : -28 - lane * 8), endY = b.y + (forward ? -28 - lane * 8 : 128 + lane * 12);
        rail = Math.max(a.x, b.x) + 224 + lane * 4;
        points = [[sx, sy], [sx, startY], [rail, startY], [rail, endY], [ex, endY], [ex, ey]];
      }
    } else {
      sy = a.y + 48; ey = b.y + 48;
      sx = a.x + (forward || same ? 210 : -2); ex = b.x + (forward && !same ? -8 : 216);
      if (!same && a.y === b.y && Math.abs(b.x - a.x) === 328) points = [[sx, sy], [ex, ey]];
      else if (same) points = [[sx, sy], [a.x + 248 + lane * 8, sy], [a.x + 248 + lane * 8, ey], [ex, ey]];
      else {
        var startX = a.x + (forward ? 248 + lane * 8 : -40 - lane * 8), endX = b.x + (forward ? -40 - lane * 8 : 248 + lane * 8);
        rail = Math.max(a.y, b.y) + 128 + lane * 12;
        points = [[sx, sy], [startX, sy], [startX, rail], [endX, rail], [endX, ey], [ex, ey]];
      }
    }
    var middle = Math.floor((points.length - 1) / 2), before = points[points.length - 2];
    var dx = Math.sign(ex - before[0]), dy = Math.sign(ey - before[1]);
    return { points: points, path: points.map(function (pt, i) { return (i ? "L" : "M") + pt[0] + " " + pt[1]; }).join(" "),
      mx: (points[middle][0] + points[middle + 1][0]) / 2, my: (points[middle][1] + points[middle + 1][1]) / 2,
      arrow: (ex + dx * 6) + "," + (ey + dy * 6) + " " + (ex - dx * 3 - dy * 5) + "," + (ey - dy * 3 + dx * 5) + " " + (ex - dx * 3 + dy * 5) + "," + (ey - dy * 3 - dx * 5) };
  }

  function CoreDiagramV2(p) {
    var seen = Object.create(null);
    var nodes = (Array.isArray(p.nodes) ? p.nodes : []).filter(function (n) {
      if (!n || typeof n.id !== "string" || seen[n.id]) return false;
      seen[n.id] = true; return true;
    }).slice(0, 200);
    var ids = Object.create(null); nodes.forEach(function (n) { ids[n.id] = true; });
    var edges = (Array.isArray(p.edges) ? p.edges : []).filter(function (e) { return e && ids[e.from] && ids[e.to] && e.from !== e.to; }).slice(0, 400);
    // An explicit-coordinate document has already chosen its geometry; keep it.
    if (nodes.some(function (n) { return typeof n.x === "number" || typeof n.y === "number"; })) return CoreDiagram(p);
    if (!nodes.length) return h("figure", { className: "kg-diagram" }, h("p", null, p.empty || "No connections to show"));
    var layout = choice(p.layout, ["auto", "horizontal", "vertical", "grid"], "auto"), ranks = layout === "grid" ? null : diagramLayers(nodes, edges);
    function drawing(vertical) {
      var pos = Object.create(null), lanes = Object.create(null), width = 248, height = 136;
      nodes.forEach(function (n, i) {
        var col, row;
        if (ranks) {
          var rank = ranks[n.id], lane = lanes[rank] || 0; lanes[rank] = lane + 1;
          col = vertical ? lane : rank; row = vertical ? rank : lane;
        } else { col = vertical ? 0 : i % 3; row = vertical ? i : Math.floor(i / 3); }
        if (p.__layout === "sequence") { col = i; row = 0; }
        if (p.__layout === "swimlane") {
          var groups = []; nodes.forEach(function (node) { var group = node.group || "Other"; if (groups.indexOf(group) < 0) groups.push(group); });
          row = groups.indexOf(n.group || "Other");
          col = nodes.slice(0, i).filter(function (node) { return (node.group || "Other") === (n.group || "Other"); }).length;
        }
        pos[n.id] = { x: 20 + col * (vertical ? 248 : 328), y: 20 + row * 184 };
        width = Math.max(width, pos[n.id].x + 228); height = Math.max(height, pos[n.id].y + 116);
      });
      var labels = [], occupiedLabels = [];
      var connections = edges.map(function (edge, i) {
        var a = pos[edge.from], b = pos[edge.to], forward = vertical ? b.y >= a.y : b.x >= a.x;
        var sx = vertical ? a.x + 104 : a.x + (forward ? 210 : -2), sy = vertical ? a.y + (forward ? 98 : -2) : a.y + 48;
        var ex = vertical ? b.x + 104 : b.x + (forward ? -8 : 216), ey = vertical ? b.y + (forward ? -8 : 104) : b.y + 48;
        var mx = (sx + ex) / 2, my = (sy + ey) / 2;
        var path = vertical ? "M" + sx + " " + sy + " C" + sx + " " + my + " " + ex + " " + my + " " + ex + " " + ey
          : "M" + sx + " " + sy + " C" + mx + " " + sy + " " + mx + " " + ey + " " + ex + " " + ey;
        var arrow = vertical ? ex + "," + (ey + (forward ? 6 : -6)) + " " + (ex - 5) + "," + (ey + (forward ? -3 : 3)) + " " + (ex + 5) + "," + (ey + (forward ? -3 : 3))
          : (ex + (forward ? 6 : -6)) + "," + ey + " " + (ex + (forward ? -3 : 3)) + "," + (ey - 5) + " " + (ex + (forward ? -3 : 3)) + "," + (ey + 5);
        if (p.__route) {
          var routed = diagramRoute(a, b, vertical, i);
          path = routed.path; arrow = routed.arrow; mx = routed.mx; my = routed.my;
          routed.points.forEach(function (pt) { width = Math.max(width, pt[0] + 20); height = Math.max(height, pt[1] + 20); });
        }
        if (edge.label) {
          var text = diagramLines(edge.label, p.__route ? 14 : 16, 1)[0], lw = Math.max(30, text.length * 7 + 12), place = true;
          if (p.__route) {
            var options = [[0, 0], [0, 26], [0, -26], [lw + 8, 0], [-lw - 8, 0], [0, 52], [0, -52]];
            var found = options.find(function (offset) {
              var box = { x: mx + offset[0] - lw / 2, y: my + offset[1] - 10, w: lw, h: 20 };
              if (box.x < 2 || box.y < 2) return false;
              function touches(other) { return box.x < other.x + other.w + 4 && box.x + box.w + 4 > other.x && box.y < other.y + other.h + 4 && box.y + box.h + 4 > other.y; }
              if (nodes.some(function (node) { return touches({ x: pos[node.id].x, y: pos[node.id].y, w: 208, h: 96 }); }) || occupiedLabels.some(touches)) return false;
              occupiedLabels.push(box); return true;
            });
            place = !!found;
            if (found) { mx += found[0]; my += found[1]; width = Math.max(width, mx + lw / 2 + 12); height = Math.max(height, my + 22); }
          }
          // Every relationship remains in the connection table when no safe
          // visual label position exists; hiding a collision must not lose data.
          if (place) labels.push(h("g", { key: i }, h("title", null, String(edge.label)), h("rect", { className: "kg-diagram__edge-chip", x: mx - lw / 2, y: my - 10, width: lw, height: 20, rx: 5 }), h("text", { className: "kg-diagram__edge-label", x: mx, y: my + 4, textAnchor: "middle" }, text)));
        }
        return h("g", { key: i, opacity: Array.isArray(p.__connected) && (p.__connected.indexOf(edge.from) < 0 || p.__connected.indexOf(edge.to) < 0) ? .2 : undefined, className: "kg-palette-" + regionPalette(edge.palette) }, h("title", null, edge.from + " → " + edge.to + (edge.label ? ": " + String(edge.label) : "")), h("path", { className: "kg-diagram__edge", d: path }), h("polygon", { className: "kg-diagram__arrow", points: arrow }));
      });
      return h("svg", { viewBox: "0 0 " + width + " " + height, style: { minWidth: Math.round(width * .85) }, role: p.interactive ? "group" : "img", "aria-label": p.label }, h("title", null, p.label), connections,
        nodes.map(function (n) {
          var at = pos[n.id], selected = p.selected === n.id;
          var attrs = { key: n.id, transform: "translate(" + at.x + " " + at.y + ")", className: "kg-diagram__node kg-palette-" + regionPalette(n.palette), "aria-label": String(n.label || n.id) + (n.group ? ": " + String(n.group) : "") };
          if (Array.isArray(p.__connected) && p.__connected.indexOf(n.id) < 0) attrs.opacity = .25;
          if (p.interactive) {
            attrs.role = "button"; attrs.tabIndex = 0; attrs["aria-pressed"] = selected;
            attrs.onClick = function () { fire(p.onSelect, { id: n.id }); };
            attrs.onKeyDown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(p.onSelect, { id: n.id }); } };
          }
          var lines = diagramLines(n.label || n.id, 23, n.group ? 2 : 3), start = n.group ? 49 : 48 - (lines.length - 1) * 10;
          return h("g", attrs, h("title", null, String(n.label || n.id)),
            h("rect", { className: "kg-diagram__box", x: 0, y: 0, width: 208, height: 96, rx: 12 }),
            h("rect", { className: "kg-diagram__stripe", x: 0, y: 16, width: 4, height: 64, rx: 2 }),
            n.group ? h("text", { className: "kg-diagram__group", x: 16, y: 25 }, diagramLines(n.group, 26, 1)[0]) : null,
            h("text", { className: "kg-diagram__label", x: 16, y: start }, lines.map(function (line, i) { return h("tspan", { key: i, x: 16, dy: i ? 20 : 0 }, line); })));
        }), labels);
    }
    return h("figure", { className: "kg-diagram", "aria-label": p.label },
      layout === "auto" ? [h("div", { key: "desktop", className: "kg-diagram__viewport kg-diagram__desktop" }, drawing(false)), h("div", { key: "mobile", className: "kg-diagram__viewport kg-diagram__mobile" }, drawing(true))]
        : h("div", { className: "kg-diagram__viewport" }, drawing(layout === "vertical")),
      h("figcaption", { className: "kg-diagram__caption" }, p.caption || p.label));
  }
  core.diagram = contract("core", "diagram", "1.2.0", "kages/diagram@1", CoreDiagramV2, {
    props: { layout: S("string", { enum: ["auto", "horizontal", "vertical", "grid"], default: "auto" }), selected: S("string"), empty: S("string") },
    tokens: contracts["core/diagram@1.1.0"].tokens,
    agent: { use: "nodes [{id,label,group?,palette?}], edges [{from,to,label?,palette?}]. Palettes: inherit,ocean,mint,violet,amber,rose; assign by role and reuse across the page. Directed graphs are layered by edges; cycles use a grid. layout:auto becomes vertical in narrow containers; horizontal,vertical,grid are explicit. Full nodes support click/Enter/Space when interactive:true; select emits {id} and selected is public. Bind selected and a detail panel to the same state. group is a short category label. Explicit x/y uses the legacy geometry path (no palettes or selected highlight); use scene for arbitrary geometry. Caption states the takeaway, not just the title." }
  });
  contracts[core.diagram].local = { selected: { type: "string", default: "" } };
  contracts[core.diagram].outputs = ["selected"];
  contracts[core.diagram].defaults = { select: [{ do: "setLocal", key: "selected", value: { $event: "id" } }] };
  Object.assign(interfaces["kages/diagram@1"].props, contracts[core.diagram].props);
  interfaces["kages/diagram@1"].outputs = ["selected"];
  contracts[core.diagram].a11y = { keyboard: "Tab to a node; Enter or Space selects. Selection is exposed with aria-pressed. Narrow diagrams reflow vertically; large branched graphs scroll without shrinking labels." };
  Object.assign(freeFlowExports, { CoreDiagramV2: CoreDiagramV2 });
  freeFlowExports.diagramRoute = diagramRoute;
