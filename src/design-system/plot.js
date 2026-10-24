/* Cartesian charts share one bounded coordinate model. Responsive geometry
 * uses the container width, not a scaled desktop SVG, so phone labels remain
 * readable. Selection and range changes are data events, never callbacks from
 * an artifact. Existing refs retain the earlier plot implementations. */
  function plotNumber(v) { return typeof v === "number" && isFinite(v); }
  function plotScale(values, min, max, start, end, zero) {
    var lo = plotNumber(min) ? min : Math.min.apply(null, values), hi = plotNumber(max) ? max : Math.max.apply(null, values);
    if (zero) { if (!plotNumber(min)) lo = Math.min(0, lo); if (!plotNumber(max)) hi = Math.max(0, hi); }
    if (lo > hi) { var swap = lo; lo = hi; hi = swap; }
    if (lo === hi) { if (lo > 0) lo = 0; else if (hi < 0) hi = 0; else hi = 1; }
    var magnitude = Math.max(Math.abs(lo), Math.abs(hi), 1), a = lo / magnitude, b = hi / magnitude;
    return { lo: lo, hi: hi,
      // A bounded offscreen coordinate can be clipped; Infinity cannot. This
      // also protects explicitly narrow domains against extreme input values.
      position: function (v) { return start + Math.max(-1, Math.min(2, a === b ? .5 : (v / magnitude - a) / (b - a))) * (end - start); },
      tick: function (i) { return (a + (b - a) * i / 4) * magnitude; }
    };
  }
  function plotLabel(value, format) {
    if (format === "date") {
      var date = new Date(value);
      return isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(date) : "Invalid date";
    }
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1, style: format === "currency" ? "currency" : format === "percent" ? "percent" : "decimal", currency: "USD" }).format(value);
  }
  function CoreCartesianPlot(p) {
    var React = R(), element = React.useRef(null), size = React.useState(640), width = size[0];
    React.useEffect(function () {
      if (!element.current || typeof W.ResizeObserver !== "function") return;
      var observer = new W.ResizeObserver(function (entries) { size[1](Math.max(240, Math.min(1600, entries[0].contentRect.width))); });
      observer.observe(element.current); return function () { observer.disconnect(); };
    }, []);
    var focus = React.useState(""), points = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && plotNumber(it.x) && plotNumber(it.y); }).slice(0, 2000);
    if (!points.length) return emptyChart(p);
    var plotHeight = p.__sharp ? Math.max(180, Math.min(480, plotNumber(p.height) ? p.height : 260)) : 290;
    var left = width < 400 ? 48 : 62, right = width - 20, top = 24, bottom = plotHeight - 40;
    var x = plotScale(points.map(function (it) { return it.x; }), p.xMin, p.xMax, left, right, false);
    var ys = []; points.forEach(function (it) { ys.push(it.y); if (plotNumber(it.lower)) ys.push(it.lower); if (plotNumber(it.upper)) ys.push(it.upper); });
    var y = plotScale(ys, p.yMin, p.yMax, bottom, top, p.kind === "area");
    var rangeInput = p.range && plotNumber(p.range.min) && plotNumber(p.range.max) ? p.range : { min: x.lo, max: x.hi };
    var range = { min: Math.max(x.lo, Math.min(x.hi, Math.min(rangeInput.min, rangeInput.max))), max: Math.max(x.lo, Math.min(x.hi, Math.max(rangeInput.min, rangeInput.max))) };
    var domain = Array.isArray(p.colorDomain) ? p.colorDomain.slice(0, 256) : [];
    function id(it, i) { return String(it.id == null ? it.label == null ? i : it.label : it.id); }
    function inRange(it) { return it.x >= range.min && it.x <= range.max; }
    function coords(it) { return r2(x.position(it.x)) + " " + r2(y.position(it.y)); }
    var groups = Object.create(null);
    points.forEach(function (it) { var key = String(it.series || "Series"); (groups[key] || (groups[key] = [])).push(it); });
    var hidden = Array.isArray(p.hiddenSeries) ? p.hiddenSeries : [];
    var shapes = [];
    for (var t = 0; t <= 4; t++) {
      var integerStep = Math.max(1, Math.ceil((x.hi - x.lo) / 4));
      var xv = p.__sharp && p.xTicks === "integer" ? Math.ceil(x.lo) + t * integerStep : x.tick(t), yv = y.tick(t), px = x.position(xv), py = y.position(yv);
      shapes.push(h("line", { key: "grid" + t, x1: left, x2: right, y1: py, y2: py, stroke: "var(--kg-line)" }));
      shapes.push(h("text", { key: "ytick" + t, x: left - 8, y: py + 4, textAnchor: "end", fill: "var(--kg-ink-muted)", fontSize: 11 }, plotLabel(yv, p.yFormat)));
      // Three ticks on phones avoid colliding long date labels.
      if (xv <= x.hi && (p.__sharp && p.xTicks === "integer" || width >= 400 || t % 2 === 0)) shapes.push(h("text", { key: "xtick" + t, x: px, y: bottom + 20, textAnchor: t === 0 ? "start" : t === 4 ? "end" : "middle", fill: "var(--kg-ink-muted)", fontSize: 11 }, plotLabel(xv, p.xFormat)));
    }
    var axes = shapes; shapes = [];
    if (p.rangeControls) shapes.push(h("rect", { key: "range", x: x.position(range.min), y: top, width: Math.max(0, x.position(range.max) - x.position(range.min)), height: bottom - top, fill: "var(--kg-data-0)", fillOpacity: .06, pointerEvents: "none" }));
    Object.keys(groups).forEach(function (key) {
      if (hidden.indexOf(key) >= 0) return;
      var series = groups[key].slice().sort(function (a, b) { return a.x - b.x; }), paint = Object.keys(groups).length === 1 && !series[0].series ? "var(--kg-data-0)" : categoryPaint(domain, key);
      var path = series.map(function (it, i) { return (i ? "L" : "M") + coords(it); }).join(" ");
      var bands = series.filter(function (it) { return plotNumber(it.lower) && plotNumber(it.upper) && it.lower <= it.upper; });
      if (bands.length === series.length && bands.length > 1) {
        var band = bands.map(function (it, i) { return (i ? "L" : "M") + r2(x.position(it.x)) + " " + r2(y.position(it.upper)); }).concat(bands.slice().reverse().map(function (it) { return "L" + r2(x.position(it.x)) + " " + r2(y.position(it.lower)); })).join(" ") + " Z";
        shapes.push(h("path", { key: key + "band", d: band, fill: paint, fillOpacity: .16 }, h("title", null, key + " supplied lower/upper bounds")));
      }
      if (p.kind === "area") shapes.push(h("path", { key: key + "area", d: path + " L" + r2(x.position(series[series.length - 1].x)) + " " + y.position(0) + " L" + r2(x.position(series[0].x)) + " " + y.position(0) + " Z", fill: paint, fillOpacity: .15 }));
      if (p.kind !== "scatter") shapes.push(h("path", { key: key + "line", d: path, fill: "none", stroke: paint, strokeWidth: 2.5 }));
    });
    points.forEach(function (it, i) {
      if (hidden.indexOf(String(it.series || "Series")) >= 0) return;
      var key = id(it, i), selected = p.selected === key, active = focus[0] === key, outside = !inRange(it);
      var label = (it.label || key) + ": " + (p.xLabel || "X") + " " + plotLabel(it.x, p.xFormat) + ", " + (p.yLabel || "Y") + " " + plotLabel(it.y, p.yFormat);
      var attrs = { key: "point" + i, "data-point-id": key, cx: r2(x.position(it.x)), cy: r2(y.position(it.y)), r: selected || active ? 7 : 4, fill: it.series ? categoryPaint(domain, String(it.series)) : "var(--kg-data-0)", opacity: outside ? .25 : 1, stroke: selected || active ? "var(--kg-ink)" : "var(--kg-paper)", strokeWidth: selected || active ? 2 : 1, "aria-label": label };
      attrs.onMouseEnter = function () { focus[1](key); }; attrs.onMouseLeave = function () { focus[1](""); };
      attrs.onFocus = function () { focus[1](key); }; attrs.onBlur = function () { focus[1](""); };
      if (p.interactive) {
        var select = function () { fire(p.onSelect, { id: key, label: String(it.label || key), x: it.x, y: it.y, index: i }); };
        attrs.role = "button"; attrs.tabIndex = 0; attrs["aria-pressed"] = selected; attrs.onClick = select;
        attrs.onKeyDown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); select(); } };
      }
      if (p.__sharp && p.interactive) {
        // Keep the visible mark small while providing a 28px pointer target.
        var visible = { cx: attrs.cx, cy: attrs.cy, r: attrs.r, fill: attrs.fill, stroke: attrs.stroke, strokeWidth: attrs.strokeWidth, opacity: attrs.opacity, pointerEvents: "none", "aria-hidden": true };
        shapes.push(h("g", { key: attrs.key }, h("circle", Object.assign({}, attrs, { r: 14, fill: "transparent", stroke: "none" }), h("title", null, label)), h("circle", visible)));
      } else shapes.push(h("circle", attrs, h("title", null, label)));
    });
    (Array.isArray(p.annotations) ? p.annotations : []).slice(0, 20).forEach(function (a, i) {
      if (!a || !plotNumber(a.value)) return;
      var vertical = a.axis === "x", pos = vertical ? x.position(a.value) : y.position(a.value);
      if (vertical ? pos < left || pos > right : pos < top || pos > bottom) return;
      shapes.push(h("line", { key: "rule" + i, x1: vertical ? pos : left, x2: vertical ? pos : right, y1: vertical ? top : pos, y2: vertical ? bottom : pos, stroke: "var(--kg-ink-muted)", strokeDasharray: "4 4" }));
      shapes.push(h("text", { key: "rulelabel" + i, x: vertical ? pos + 4 : right, y: vertical ? top + 12 : pos - 5, textAnchor: vertical ? "start" : "end", fontSize: 11, fill: "var(--kg-ink)" }, shortLabel(a.label || String(a.value), 28)));
    });
    var chosen = points.find(function (it, i) { return hidden.indexOf(String(it.series || "Series")) < 0 && id(it, i) === (focus[0] || p.selected); });
    if (chosen) shapes.push(h("path", { key: "crosshair", d: "M" + left + " " + y.position(chosen.y) + " H" + right + " M" + x.position(chosen.x) + " " + top + " V" + bottom, fill: "none", stroke: "var(--kg-ink-muted)", strokeDasharray: "2 4", pointerEvents: "none" }));
    function changeRange(min, max) { fire(p.onRangeChange, { min: min, max: max }); }
    return h("div", { ref: element, className: "kg-cartesian" },
      h("div", { className: "kg-cartesian__labels" }, h("span", null, p.yLabel || p.unit || "Value"), h("span", null, p.xLabel || "Position")),
      h("svg", { viewBox: "0 0 " + width + " " + plotHeight, style: { width: "100%", height: plotHeight }, role: p.interactive ? "group" : "img", "aria-label": p.label }, h("title", null, p.label), axes,
        h("svg", { x: left - 8, y: top - 8, width: right - left + 16, height: bottom - top + 16, viewBox: (left - 8) + " " + (top - 8) + " " + (right - left + 16) + " " + (bottom - top + 16), overflow: "hidden" }, shapes)),
      p.__sharp && !chosen ? null : h("p", { className: "kg-cartesian__detail", "aria-live": "polite" }, chosen ? (chosen.label || "Point") + " · " + (p.xLabel || "X") + ": " + plotLabel(chosen.x, p.xFormat) + " · " + (p.yLabel || "Y") + ": " + plotLabel(chosen.y, p.yFormat) : p.interactive ? "Select a point to inspect it. Tab and Enter work too." : "Hover a point for its values; the full data is available below."),
      p.rangeControls && x.lo < x.hi ? h(p.__sharp ? "details" : "div", { className: "kg-cartesian__range" },
        p.__sharp ? h("summary", null, "Adjust range") : null,
        h("label", null, "Range start: " + plotLabel(range.min, p.xFormat), h("input", { type: "range", min: x.lo, max: x.hi, step: "any", value: range.min, onChange: function (e) { changeRange(Math.min(Number(e.target.value), range.max), range.max); } })),
        h("label", null, "Range end: " + plotLabel(range.max, p.xFormat), h("input", { type: "range", min: x.lo, max: x.hi, step: "any", value: range.max, onChange: function (e) { changeRange(range.min, Math.max(range.min, Number(e.target.value))); } })),
        h("button", { type: "button", onClick: function () { changeRange(x.lo, x.hi); } }, "Reset range")) : null,
      Object.keys(groups).length > 1 ? h("ul", { className: "kg-legend kg-legend--row" }, Object.keys(groups).map(function (key) {
        var toggle = typeof p.onLegendChange === "function";
        return h("li", { key: key }, h(toggle ? "button" : "span", toggle ? { type: "button", className: "kg-cartesian__legend", "aria-pressed": hidden.indexOf(key) < 0, onClick: function () { fire(p.onLegendChange, { hidden: hidden.indexOf(key) >= 0 ? hidden.filter(function (name) { return name !== key; }) : hidden.concat([key]) }); } } : {}, h("span", { className: "kg-legend__swatch", style: { background: categoryPaint(domain, key) } }), key));
      })) : null,
      dataTable(p.label, ["Label", p.xLabel || "X", p.yLabel || "Y", "Series", "Lower", "Upper"], points.map(function (it, i) { return [it.label || id(it, i), it.x, it.y, it.series || "–", plotNumber(it.lower) ? it.lower : "–", plotNumber(it.upper) ? it.upper : "–"]; })));
  }
  HANDLER.rangeChange = "onRangeChange";
  HANDLER.legendChange = "onLegendChange";
  ["line-chart", "scatter-chart", "area-chart"].forEach(function (name) {
    var previous = contracts[core[name]], iface = previous.implements[0];
    var extras = {
      interactive: S("boolean"), selected: S("string"), rangeControls: S("boolean"), range: S("object"), hiddenSeries: S("array", { items: S("string") }),
      xMin: S("number"), xMax: S("number"), yMin: S("number"), yMax: S("number"),
      xFormat: S("string", { enum: ["number", "date"], default: "number" }), yFormat: S("string", { enum: ["number", "currency", "percent"], default: "number" }),
      annotations: S("array", { items: S("object", { properties: { axis: S("string", { enum: ["x", "y"] }), value: S("number"), label: S("string") }, requiredKeys: ["axis", "value"] }) })
    };
    var itemSpec = previous.props.items.items;
    extras.items = Object.assign({}, previous.props.items, { items: Object.assign({}, itemSpec, { properties: Object.assign({}, itemSpec.properties, { id: S("string"), series: S("string"), lower: S("number"), upper: S("number") }) }) });
    interfaces[iface] = Object.assign({}, interfaces[iface], { props: Object.assign({}, interfaces[iface].props, extras), local: { selected: { type: "string", default: "" }, range: { type: "object", default: {} }, hiddenSeries: { type: "array", default: [] } }, outputs: ["selected", "range", "hiddenSeries"], events: { select: { payload: { id: "string", label: "string", x: "number", y: "number", index: "number" } }, rangeChange: { payload: { min: "number", max: "number" } }, legendChange: { payload: { hidden: "array" } } } });
    DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $event: "id" } }], rangeChange: [{ do: "setLocal", key: "range", value: { min: { $event: "min" }, max: { $event: "max" } } }], legendChange: [{ do: "setLocal", key: "hiddenSeries", value: { $event: "hidden" } }] };
    core[name] = contract("core", name, "1.2.0", iface, framedChart(function (p) { return h(CoreCartesianPlot, Object.assign({}, p, { kind: name.split("-")[0] })); }), {
      props: Object.assign({}, previous.props, extras), tokens: previous.tokens,
      agent: { use: "items [{id?,x,y,label?,series?,lower?,upper?}]. Uses responsive axes, optional supplied uncertainty bounds and reference annotations [{axis:x|y,value,label?}]. xFormat:date interprets numeric milliseconds in UTC. Set xMin/xMax/yMin/yMax for comparable scales. interactive:true selects points and exposes selected; select emits {id,label,x,y,index}. rangeControls:true exposes range {min,max} and rangeChange {min,max} for linked filters. Supply unique IDs for stable identity. colorDomain maps series names to stable colors. Bounds are supplied evidence, never inferred confidence. " + previous.agent.use }
    });
  });
  Object.assign(freeFlowExports, { CoreCartesianPlot: CoreCartesianPlot });
