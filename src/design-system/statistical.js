/* Distribution and change views accept bounded data and keep exact values in
 * tables. Box plots render supplied summaries: the renderer never invents a
 * statistical test or confidence interval. Small multiples share domains so
 * independently autoscaled panels cannot exaggerate a comparison. */
  function CoreHistogram(p) {
    var values = (Array.isArray(p.values) ? p.values : []).filter(plotNumber).slice(0, 10000);
    if (!values.length) return emptyChart(p);
    var lo = Math.min.apply(null, values), hi = Math.max.apply(null, values), magnitude = Math.max(1, Math.abs(lo), Math.abs(hi));
    var a = lo / magnitude, b = hi / magnitude, count = lo === hi ? 1 : Math.max(2, Math.min(30, Math.floor(richNum(p.bins, 10))));
    var buckets = Array.from({ length: count }, function (_, i) { return { lo: (a + (b - a) * i / count) * magnitude, hi: (a + (b - a) * (i + 1) / count) * magnitude, value: 0 }; });
    values.forEach(function (v) { var at = lo === hi ? 0 : Math.min(count - 1, Math.floor((v / magnitude - a) / (b - a) * count)); buckets[Math.max(0, at)].value++; });
    var max = Math.max.apply(null, buckets.map(function (bucket) { return bucket.value; }));
    return h("figure", { className: "kg-histogram", "aria-label": p.label }, h("figcaption", null, p.label),
      h("p", { className: "kg-chart-frame__unit" }, values.length + " observations · " + count + " equal-width bins"),
      h("div", { className: "kg-histogram__bars" }, buckets.map(function (bucket, i) {
        var label = plotLabel(bucket.lo) + " to " + plotLabel(bucket.hi), chosen = p.selected === String(i);
        return h("button", { key: i, type: "button", className: "kg-histogram__bin", "aria-label": label + ": " + bucket.value + " observations", "aria-pressed": chosen, onClick: function () { fire(p.onSelect, { id: String(i), min: bucket.lo, max: bucket.hi, count: bucket.value }); } },
          h("span", { className: "kg-histogram__column", style: { height: (bucket.value / max * 100) + "%" } }, h("span", null, bucket.value)), count <= 8 ? h("span", { className: "kg-histogram__index" }, label) : null);
      })),
      h("div", { className: "kg-histogram__extent" }, h("span", null, plotLabel(lo)), h("span", null, plotLabel(hi))),
      p.selected !== "" && buckets[Number(p.selected)] ? h("p", { role: "status" }, "Selected bin " + (Number(p.selected) + 1) + ": " + buckets[Number(p.selected)].value + " observations, " + plotLabel(buckets[Number(p.selected)].lo) + " to " + plotLabel(buckets[Number(p.selected)].hi)) : null,
      h("p", { className: "kg-chart-frame__unit" }, "Bins include the lower edge and exclude the upper edge, except the last bin includes both."),
      dataTable(p.label, ["Bin", "From", "To", "Count"], buckets.map(function (bucket, i) { return [i + 1, bucket.lo, bucket.hi, bucket.value]; })));
  }
  function CoreBoxPlot(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && [it.min, it.q1, it.median, it.q3, it.max].every(plotNumber) && it.min <= it.q1 && it.q1 <= it.median && it.median <= it.q3 && it.q3 <= it.max; }).slice(0, 50);
    if (!items.length) return emptyChart(p);
    var all = []; items.forEach(function (it) { all.push(it.min, it.max); });
    var scale = plotScale(all, p.min, p.max, 8, 92, false), domain = Array.isArray(p.colorDomain) ? p.colorDomain : [];
    return h("figure", { className: "kg-box-plot", "aria-label": p.label }, h("figcaption", null, p.label),
      items.map(function (it, i) { var paint = domain.length ? categoryPaint(domain, it.label) : "var(--kg-data-0)"; return h("div", { className: "kg-box-plot__row", key: i }, h("strong", null, it.label),
        h("svg", { viewBox: "0 0 100 16", role: "img", "aria-label": it.label + ": median " + it.median + ", range " + it.min + " to " + it.max, preserveAspectRatio: "none" },
          h("line", { x1: scale.position(it.min), x2: scale.position(it.max), y1: 8, y2: 8, stroke: "var(--kg-ink-muted)", strokeWidth: .4 }),
          [it.min, it.max].map(function (v, j) { return h("line", { key: j, x1: scale.position(v), x2: scale.position(v), y1: 5, y2: 11, stroke: "var(--kg-ink-muted)", strokeWidth: .4 }); }),
          h("rect", { x: scale.position(it.q1), y: 3, width: Math.max(.2, scale.position(it.q3) - scale.position(it.q1)), height: 10, fill: paint, fillOpacity: .3, stroke: paint, strokeWidth: .4 }),
          h("line", { x1: scale.position(it.median), x2: scale.position(it.median), y1: 3, y2: 13, stroke: "var(--kg-ink)", strokeWidth: .6 })),
        h("span", null, "Median " + plotLabel(it.median)));
      }),
      h("div", { className: "kg-histogram__extent" }, h("span", null, plotLabel(scale.lo)), h("span", null, plotLabel(scale.hi))),
      h("p", { className: "kg-chart-frame__unit" }, "Box: supplied first to third quartile. Line: median. Whiskers: supplied minimum and maximum."),
      dataTable(p.label, ["Group", "Minimum", "Q1", "Median", "Q3", "Maximum"], items.map(function (it) { return [it.label, it.min, it.q1, it.median, it.q3, it.max]; })));
  }
  function CoreWaterfall(p) {
    var running = 0, invalid = false;
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && plotNumber(it.value); }).slice(0, 50).map(function (it) {
      var start = it.total ? 0 : running, end = it.total ? it.value : running + it.value;
      if (!isFinite(end)) invalid = true;
      running = end; return { label: it.label, value: it.value, total: !!it.total, start: start, end: end };
    });
    if (invalid) return h("p", { role: "alert" }, "The cumulative values exceed the supported numeric range. Rescale the units.");
    if (!items.length) return emptyChart(p);
    var values = [0]; items.forEach(function (it) { values.push(it.start, it.end); });
    var scale = plotScale(values, undefined, undefined, 100, 0, true);
    return h("figure", { className: "kg-waterfall", "aria-label": p.label }, h("figcaption", null, p.label),
      h("div", { className: "kg-waterfall__columns" }, items.map(function (it, i) {
        var top = Math.min(scale.position(it.start), scale.position(it.end)), height = Math.abs(scale.position(it.end) - scale.position(it.start));
        return h("div", { key: i, className: "kg-waterfall__column" },
          h("div", { className: "kg-waterfall__plot", "aria-label": it.label + ": " + it.value + ", running total " + it.end },
            h("span", { className: "kg-waterfall__zero", style: { top: scale.position(0) + "%" } }),
            h("span", { className: "kg-waterfall__bar", style: { top: top + "%", height: Math.max(.5, height) + "%", background: it.total ? "var(--kg-data-2)" : it.value >= 0 ? "var(--kg-data-0)" : "var(--kg-data-1)" } })),
          h("strong", null, plotLabel(it.value, p.format)), h("span", null, it.label));
      })),
      h("p", { className: "kg-chart-frame__unit" }, "Blue adds; cyan subtracts; violet is an explicit total. Final value: " + plotLabel(running, p.format)),
      dataTable(p.label, ["Step", "Value", "Running total", "Explicit total"], items.map(function (it) { return [it.label, it.value, it.end, it.total ? "Yes" : "No"]; })));
  }
  function CoreSmallMultiples(p) {
    var panels = (Array.isArray(p.panels) ? p.panels : []).filter(function (panel) { return panel && Array.isArray(panel.items); }).slice(0, 12);
    var xs = [], ys = [];
    panels.forEach(function (panel) { panel.items.slice(0, 1000).forEach(function (it) { if (it && plotNumber(it.x) && plotNumber(it.y)) { xs.push(it.x); ys.push(it.y); if (plotNumber(it.lower)) ys.push(it.lower); if (plotNumber(it.upper)) ys.push(it.upper); } }); });
    if (!xs.length) return emptyChart(p);
    var xmin = Math.min.apply(null, xs), xmax = Math.max.apply(null, xs), ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys);
    return h("div", { className: "kg-small-multiples" }, panels.map(function (panel, i) {
      var props = Object.assign({}, p, { label: String(panel.label || "Panel " + (i + 1)), items: panel.items.slice(0, 1000), kind: p.kind === "scatter" ? "scatter" : "line", xMin: xmin, xMax: xmax, yMin: ymin, yMax: ymax, rangeControls: false, selected: p.selected && p.selected.panel === String(i) ? p.selected.id : "", onSelect: function (e) { fire(p.onSelect, Object.assign({}, e, { panel: String(i) })); } });
      return h("section", { key: i, className: "kg-small-multiples__panel" }, h("h4", null, props.label), h(CoreCartesianPlot, props));
    }));
  }
  var STATISTICAL = {
    "histogram-chart": { summary: "Frequency distribution with equal-width bins, selectable ranges and exact counts.", props: { label: S("string", { required: true }), values: S("array", { required: true, items: S("number") }), bins: S("number"), selected: S("string"), empty: S("string") }, local: { selected: { type: "string", default: "" } }, outputs: ["selected"], events: { select: { payload: { id: "string", min: "number", max: "number", count: "number" } } } },
    "box-plot": { summary: "Compare supplied five-number summaries on a shared horizontal scale.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), min: S("number"), q1: S("number"), median: S("number"), q3: S("number"), max: S("number") }, requiredKeys: ["label", "min", "q1", "median", "q3", "max"] }) }), min: S("number"), max: S("number"), empty: S("string") } },
    "waterfall-chart": { summary: "Explain positive/negative contributions and explicit totals in sequence.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number"), total: S("boolean") }, requiredKeys: ["label", "value"] }) }), format: S("string", { enum: ["number", "currency", "percent"] }), empty: S("string") } },
    "small-multiples": { summary: "Compare up to twelve line or scatter panels using the same X/Y domains.", props: { label: S("string", { required: true }), panels: S("array", { required: true, items: S("object", { properties: { label: S("string"), items: contracts[core["line-chart"]].props.items }, requiredKeys: ["label", "items"] }) }), kind: S("string", { enum: ["line", "scatter"], default: "line" }), interactive: S("boolean"), selected: S("object"), xLabel: S("string"), yLabel: S("string"), empty: S("string") }, local: { selected: { type: "object", default: {} } }, outputs: ["selected"], events: { select: { payload: { panel: "string", id: "string", label: "string", x: "number", y: "number", index: "number" } } } }
  };
  var statisticalImpls = { "histogram-chart": CoreHistogram, "box-plot": CoreBoxPlot, "waterfall-chart": CoreWaterfall, "small-multiples": CoreSmallMultiples };
  Object.keys(STATISTICAL).forEach(function (name) {
    var I = STATISTICAL[name]; I.role = name; I.props = Object.assign({}, I.props, CHART_CONTEXT); I.slots = {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "histogram-chart") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $event: "id" } }] };
    if (name === "small-multiples") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { panel: { $event: "panel" }, id: { $event: "id" } } }] };
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", framedChart(statisticalImpls[name]), { agent: { use: I.summary + " Supply a takeaway, unit and source; label sample data illustrative. Histogram: values and bins (2–30); select emits bin id/min/max/count. Box: ordered min/q1/median/q3/max, never inferred confidence. Waterfall: items {label,value,total?}; total sets the running value. Small multiples: panels [{label,items:[{x,y,id?,label?}]}], shared domains and optional point selection." } });
  });
  Object.assign(freeFlowExports, { CoreHistogram: CoreHistogram, CoreBoxPlot: CoreBoxPlot, CoreWaterfall: CoreWaterfall, CoreSmallMultiples: CoreSmallMultiples });
