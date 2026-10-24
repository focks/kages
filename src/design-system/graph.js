/* Graph exploration is an optional reader surface over bounded diagram data.
 * It never intercepts wheel events: ordinary scrolling must remain usable in
 * embedded previews and published pages. Collapsing groups preserves edges by
 * projecting them onto explicit summary nodes rather than dropping relations. */
  function CoreGraphExplorer(p) {
    var React = R(), query = React.useState(""), zoom = React.useState(1), neighbors = React.useState(false), viewport = React.useRef(null);
    var nodes = (Array.isArray(p.nodes) ? p.nodes : []).filter(function (n) { return n && typeof n.id === "string"; }).slice(0, 200);
    var edges = (Array.isArray(p.edges) ? p.edges : []).filter(function (e) { return e && typeof e.from === "string" && typeof e.to === "string"; }).slice(0, 400);
    var groups = []; nodes.forEach(function (n) { if (n.group && groups.indexOf(n.group) < 0) groups.push(n.group); });
    var collapsed = Array.isArray(p.collapsedGroups) ? p.collapsedGroups : [], projected = Object.create(null), summary = Object.create(null), shown = [];
    groups.forEach(function (group) {
      if (collapsed.indexOf(group) < 0) return;
      var key = "group:" + group;
      while (nodes.some(function (n) { return n.id === key; }) || summary[key]) key = "_" + key;
      summary[key] = group;
      var members = nodes.filter(function (n) { return n.group === group; });
      shown.push({ id: key, label: group + " · " + members.length + " nodes", group: "Select to expand", palette: members[0].palette });
      members.forEach(function (n) { projected[n.id] = key; });
    });
    nodes.forEach(function (n) { if (!projected[n.id]) { projected[n.id] = n.id; shown.push(n); } });
    var projectedEdges = [], used = Object.create(null);
    edges.forEach(function (e) {
      var from = projected[e.from], to = projected[e.to]; if (!from || !to || from === to) return;
      var key = JSON.stringify([from, to]);
      if (used[key]) { used[key].count++; used[key].label = used[key].count + " connections"; }
      else { var copy = Object.assign({}, e, { from: from, to: to, count: 1 }); used[key] = copy; projectedEdges.push(copy); }
    });
    var connected = p.selected ? [projected[p.selected] || p.selected] : [];
    projectedEdges.forEach(function (e) { if (e.from === connected[0]) connected.push(e.to); if (e.to === connected[0]) connected.push(e.from); });
    var matches = query[0].trim() ? nodes.filter(function (n) { return String(n.label || n.id).toLowerCase().indexOf(query[0].trim().toLowerCase()) >= 0; }) : [];
    function setGroups(value) { fire(p.onGroupsChange, { groups: value }); }
    function select(id) {
      if (summary[id]) { setGroups(collapsed.filter(function (g) { return g !== summary[id]; })); return; }
      var node = nodes.find(function (n) { return n.id === id; });
      if (node && collapsed.indexOf(node.group) >= 0) setGroups(collapsed.filter(function (g) { return g !== node.group; }));
      fire(p.onSelect, { id: id });
    }
    function fit() {
      if (!viewport.current) return;
      var svg = Array.from(viewport.current.querySelectorAll("svg")).find(function (el) { return el.getClientRects().length && getComputedStyle(el).display !== "none"; });
      if (svg && svg.viewBox.baseVal.width) zoom[1](Math.max(.25, Math.min(1, viewport.current.clientWidth / svg.viewBox.baseVal.width)));
      viewport.current.scrollTo({ left: 0, top: 0 });
    }
    var layout = choice(p.layout, ["auto", "horizontal", "vertical", "grid", "tree", "swimlane", "sequence"], "auto");
    var content = h(CoreDiagramV2, Object.assign({}, p, { nodes: shown, edges: projectedEdges, selected: projected[p.selected] || p.selected, interactive: p.explore || p.interactive, layout: layout === "tree" ? "vertical" : layout === "swimlane" || layout === "sequence" ? "horizontal" : layout, __layout: layout, __connected: neighbors[0] && connected.length ? connected : null, onSelect: function (e) { select(e.id); } }));
    var table = p.__route && edges.length ? dataTable(p.label + " connections", ["From", "To", "Relationship"], edges.map(function (edge) {
      var from = nodes.find(function (n) { return n.id === edge.from; }), to = nodes.find(function (n) { return n.id === edge.to; });
      return [from ? from.label || from.id : edge.from, to ? to.label || to.id : edge.to, edge.label || "Connected"];
    }), { summary: "View connections" }) : null;
    if (!p.explore) return table ? h("section", { className: "kg-graph-explorer" }, content, table) : content;
    return h("section", { className: "kg-graph-explorer", "aria-label": p.label },
      h("div", { className: "kg-graph-explorer__tools" },
        h("label", null, "Find a node", h("input", { type: "search", value: query[0], placeholder: "Search labels", onChange: function (e) { query[1](e.target.value.slice(0, 200)); } })),
        h("button", { type: "button", onClick: fit }, "Fit graph"),
        h("button", { type: "button", disabled: zoom[0] <= .25, "aria-label": "Zoom out", onClick: function () { zoom[1](Math.max(.25, zoom[0] - .25)); } }, "−"),
        h("output", { "aria-label": "Graph zoom" }, Math.round(zoom[0] * 100) + "%"),
        h("button", { type: "button", disabled: zoom[0] >= 2, "aria-label": "Zoom in", onClick: function () { zoom[1](Math.min(2, zoom[0] + .25)); } }, "+"),
        h("label", { className: "kg-graph-explorer__check" }, h("input", { type: "checkbox", checked: neighbors[0], onChange: function (e) { neighbors[1](e.target.checked); } }), "Highlight neighbors")),
      query[0].trim() ? h("div", { className: "kg-graph-explorer__matches" }, h("p", { role: "status" }, matches.length + " matching nodes"), matches.slice(0, 20).map(function (n) { return h("button", { key: n.id, type: "button", onClick: function () { select(n.id); } }, n.label || n.id); })) : null,
      groups.length ? h("div", { className: "kg-graph-explorer__groups" }, h("span", null, "Groups"), groups.map(function (group) { var open = collapsed.indexOf(group) < 0; return h("button", { key: group, type: "button", "aria-expanded": open, onClick: function () { setGroups(open ? collapsed.concat([group]) : collapsed.filter(function (g) { return g !== group; })); } }, (open ? "Collapse " : "Expand ") + group); })) : null,
      // At normal scale, mobile diagrams belong to the page's scroll flow.
      // Constrain only deliberate zoom so small screens do not hide lower nodes.
      h("div", { ref: viewport, className: "kg-graph-explorer__viewport", style: p.__route && zoom[0] <= 1 ? { maxHeight: "none" } : undefined, tabIndex: 0, "aria-label": "Graph viewport; scroll to explore" }, h("div", { style: { zoom: zoom[0] } }, content)),
      h("p", { className: "kg-graph-explorer__hint" }, "Use the zoom buttons to inspect the graph. Mouse wheel continues to scroll."), table);
  }
  HANDLER.groupsChange = "onGroupsChange";
  var graphPrevious = contracts[core.diagram], graphInterface = graphPrevious.implements[0];
  var graphProps = { explore: S("boolean"), collapsedGroups: S("array", { items: S("string") }), layout: S("string", { enum: ["auto", "horizontal", "vertical", "grid", "tree", "swimlane", "sequence"], default: "auto" }) };
  interfaces[graphInterface] = Object.assign({}, interfaces[graphInterface], { props: Object.assign({}, interfaces[graphInterface].props, graphProps), events: Object.assign({}, interfaces[graphInterface].events, { groupsChange: { payload: { groups: "array" } } }), local: Object.assign({}, graphPrevious.local, { collapsedGroups: { type: "array", default: [] } }), outputs: ["selected", "collapsedGroups"] });
  DEFAULTS.diagram = Object.assign({}, graphPrevious.defaults, { groupsChange: [{ do: "setLocal", key: "collapsedGroups", value: { $event: "groups" } }] });
  core.diagram = contract("core", "diagram", "1.3.0", graphInterface, CoreGraphExplorer, { props: Object.assign({}, graphPrevious.props, graphProps), tokens: graphPrevious.tokens, agent: { use: graphPrevious.agent.use + " explore:true adds search, fit, zoom, neighbor highlighting and collapsible groups without intercepting wheel input. collapsedGroups is public state; groupsChange emits {groups}. layout:tree is vertical; swimlane groups rows, sequence keeps input order. Group summaries preserve external connections and expand on selection." } });
  Object.assign(freeFlowExports, { CoreGraphExplorer: CoreGraphExplorer });

  function CoreGraphExplorerV2(p) { return h(CoreGraphExplorer, Object.assign({}, p, { __route: true })); }
  var routedGraph = contracts[core.diagram];
  core.diagram = contract("core", "diagram", "1.4.0", graphInterface, CoreGraphExplorerV2, { props: routedGraph.props, tokens: routedGraph.tokens, agent: { use: routedGraph.agent.use + " Connections route through layout gutters. Labels avoid node boxes and other labels; the connection table preserves full text when there is insufficient room." } });
  Object.assign(freeFlowExports, { CoreGraphExplorerV2: CoreGraphExplorerV2 });
