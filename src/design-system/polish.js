/* Presentation and data colors have separate lifetimes: moving a chart into a
 * colored chapter must not change what its categories mean. New contract refs
 * opt into this frame while old refs keep their original rendering. See
 * oracle/product-polish.feature. */
  var DATA_COLOR_COUNT = 8;
  function categoryPaint(domain, key) {
    var text = String(key == null ? "" : key), index = domain.indexOf(text);
    // Unknown categories remain stable across filtering and independently
    // rendered views. Authors declare a domain to avoid hash collisions.
    if (index < 0) {
      index = 0;
      for (var i = 0; i < Math.min(text.length, 512); i++) index = (index * 31 + text.charCodeAt(i)) >>> 0;
    }
    return "var(--kg-data-" + (index % DATA_COLOR_COUNT) + ")";
  }
  var CHART_CONTEXT = {
    colorDomain: S("array", { items: S("string") }),
    takeaway: S("string"), unit: S("string"), source: S("string"), updatedAt: S("string"),
    status: S("string", { enum: ["ready", "loading", "error", "stale"], default: "ready" }),
    statusMessage: S("string")
  };
  function chartContext(p, body) {
    var status = choice(p.status, ["ready", "loading", "error", "stale"], "ready");
    return h("section", { className: "kg-chart-frame", "aria-label": p.label, "aria-busy": status === "loading" },
      h("header", { className: "kg-chart-frame__header" }, h("h3", null, p.label), p.unit ? h("span", { className: "kg-chart-frame__unit" }, p.unit) : null),
      p.takeaway ? h("p", { className: "kg-chart-frame__takeaway" }, p.takeaway) : null,
      status !== "ready" ? h("p", { className: "kg-chart-frame__status", role: status === "error" ? "alert" : "status" }, p.statusMessage || ({ loading: "Loading data…", error: "Data could not be loaded.", stale: "Showing the last available data; it may be out of date." })[status]) : null,
      status === "loading" || status === "error" ? null : h("div", { className: "kg-chart-frame__body" }, body),
      p.source || p.updatedAt ? h("footer", null, p.source ? h("span", null, "Source: " + p.source) : null, p.updatedAt ? h("span", null, "Updated: " + p.updatedAt) : null) : null);
  }
  function framedChart(impl) {
    return function (p) {
      var domain = (Array.isArray(p.colorDomain) ? p.colorDomain : []).slice(0, 256).filter(function (v) { return typeof v === "string"; });
      var props = Object.assign({}, p, { __dataPaint: function (key) { return categoryPaint(domain, key); } });
      return chartContext(p, h(impl, props));
    };
  }
  function CoreAnalyticalBars(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.value === "number" && isFinite(it.value); }).slice(0, 200);
    if (!items.length) return emptyChart(p);
    // Normalize before subtraction: opposite finite extremes otherwise create
    // an infinite span. The data table keeps the unmodified original values.
    var magnitude = Math.max.apply(null, [1].concat(items.map(function (it) { return Math.abs(it.value); })));
    var lo = Math.min.apply(null, [0].concat(items.map(function (it) { return it.value / magnitude; })));
    var hi = Math.max.apply(null, [0].concat(items.map(function (it) { return it.value / magnitude; })));
    if (lo === hi) hi = 1;
    var span = hi - lo, zero = -lo / span * 100;
    var ticks = Array.from({ length: 5 }, function (_, i) { return (lo + span * i / 4) * magnitude; });
    function number(value, compact) {
      if (!compact) return fmt(value, p.format === "text" ? "number" : p.format || "number");
      return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1, style: p.format === "currency" ? "currency" : p.format === "percent" ? "percent" : "decimal", currency: "USD" }).format(value);
    }
    return h("figure", { className: "kg-analytical-bars", "aria-label": p.label },
      h("figcaption", null, p.label),
      h("div", { className: "kg-analytical-bars__rows" }, items.map(function (it, i) {
        var end = (it.value / magnitude - lo) / span * 100, key = it.category || it.label;
        var paint = p.colorBy === "category" ? dataPaint(p, i, key) : "var(--kg-data-0)";
        var attrs = { key: i, className: "kg-analytical-bars__row", "data-category": String(key) };
        if (p.interactive) {
          attrs.type = "button"; attrs["aria-pressed"] = p.selected === it.label;
          attrs.onClick = function () { fire(p.onSelect, { label: String(it.label), value: it.value, index: i }); };
        }
        return h(p.interactive ? "button" : "div", attrs,
          h("span", { className: "kg-analytical-bars__label" }, it.label),
          h("span", { className: "kg-analytical-bars__track", "aria-hidden": "true" },
            h("span", { className: "kg-analytical-bars__zero", style: { left: zero + "%" } }),
            h("span", { className: "kg-analytical-bars__bar", style: { left: Math.min(zero, end) + "%", width: Math.abs(end - zero) + "%", background: paint } })),
          h("span", { className: "kg-analytical-bars__value", title: number(it.value) }, number(it.value, p.compactValues)));
      })),
      h("div", { className: "kg-analytical-bars__axis", "aria-hidden": "true" }, h("span"), h("div", null, ticks.map(function (v, i) { return h("span", { key: i }, number(v, true)); })), h("span")),
      dataTable(p.label, ["Category", p.unit || "Value"], items.map(function (it) { return [it.label, number(it.value)]; })));
  }
  ["bar-chart", "line-chart", "scatter-chart", "area-chart", "donut-chart", "combo-chart", "stacked-bar-chart", "funnel-chart", "treemap", "sankey", "map", "heatmap", "gauge", "sparkline"].forEach(function (name) {
    var previous = contracts[core[name]], parts = previous.version.split("."), version = parts[0] + "." + (Number(parts[1]) + 1) + ".0";
    var iface = previous.implements[0];
    if (name === "bar-chart") {
      // New optional events are installed before contract() maps their named
      // handlers; legacy refs retain their earlier event-free contract.
      interfaces[iface] = Object.assign({}, interfaces[iface], {
        props: Object.assign({}, interfaces[iface].props, { interactive: S("boolean"), selected: S("string"), compactValues: S("boolean"), colorBy: S("string", { enum: ["uniform", "category"], default: "uniform" }) }),
        local: { selected: { type: "string", default: "" } }, outputs: ["selected"],
        events: { select: { payload: { label: "string", value: "number", index: "number" } } }
      });
      DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $if: [{ $eq: [{ $self: "selected" }, { $event: "label" }] }, "", { $event: "label" }] } }] };
    }
    var next = contract("core", name, version, iface, framedChart(name === "bar-chart" ? CoreAnalyticalBars : impls[previous.ref]), {
      props: Object.assign({}, previous.props, CHART_CONTEXT), tokens: previous.tokens,
      agent: { use: previous.agent.use + " Use colorDomain:[category labels or series names] in the same order across related charts; category colors remain stable when data order/rank changes. Section palettes do not recolor data. Add takeaway, unit, source and updatedAt for context. status ready|loading|error|stale makes data availability explicit." }
    });
    if (name === "bar-chart") {
      var itemSpec = previous.props.items.items;
      contracts[next].props.items = Object.assign({}, previous.props.items, { items: Object.assign({}, itemSpec, { properties: Object.assign({}, itemSpec.properties, { category: S("string") }) }) });
    }
    core[name] = next;
  });

  function CoreCanvas(p) {
    return h("div", { className: "kg-canvas kg-canvas--" + choice(p.personality, ["editorial", "analytical", "exploratory", "teaching", "showcase"], "analytical") + " kg-canvas--" + choice(p.density, ["comfortable", "compact"], "comfortable"), "data-appearance": choice(p.appearance, ["inherit", "light", "dark"], "inherit") },
      h("div", { className: "kg-canvas__inner" },
        p.title || p.eyebrow || p.description ? h("header", { className: "kg-canvas__header" },
          p.eyebrow ? h("p", { className: "kg-canvas__eyebrow" }, p.eyebrow) : null,
          p.title ? h("h1", null, p.title) : null,
          p.description ? h("p", { className: "kg-canvas__description" }, p.description) : null) : null,
        p.actions && p.actions.length ? h("div", { className: "kg-canvas__actions" }, p.actions) : null,
        h("main", { className: "kg-canvas__content" }, p.children),
        p.footer && p.footer.length ? h("footer", { className: "kg-canvas__footer" }, p.footer) : null));
  }
  interfaces["kages/canvas@1"] = { role: "canvas", summary: "A complete artifact with a coherent presentation personality and optional explicit theme.", props: {
    title: S("string"), eyebrow: S("string"), description: S("string"),
    personality: S("string", { enum: ["editorial", "analytical", "exploratory", "teaching", "showcase"], default: "analytical" }),
    density: S("string", { enum: ["comfortable", "compact"], default: "comfortable" }),
    appearance: S("string", { enum: ["inherit", "light", "dark"], default: "inherit" })
  }, slots: { children: {}, actions: {}, footer: {} }, events: {}, outputs: [] };
  core.canvas = contract("core", "canvas", "1.0.0", "kages/canvas@1", CoreCanvas, { agent: { use: "Root for polished reports and tools. Choose analytical for compact metrics/charts, editorial for reading, exploratory for controls, teaching for progressive lessons, showcase for spacious stories. appearance:dark recreates a restrained dark analytical report; inherit follows the reader. Put metric grids and charts directly in children. Use one personality per artifact and inherit section palettes. Always label illustrative data." } });
  Object.assign(freeFlowExports, { CoreCanvas: CoreCanvas });
