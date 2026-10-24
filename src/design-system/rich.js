/* Batch 1 of the rich-artifact roles: data visualisation and disclosure.
 * Runs inside the reference closure after the expressive roles. Charts compute
 * numeric geometry from sanitised data and never forward data into SVG
 * attributes; colours are token paints picked from a fixed list. Every chart
 * also renders its values as a keyboard-reachable table so no information is
 * visual-only. See oracle/rich-artifacts.feature. */
  function richNum(n, fallback) { return typeof n === "number" && isFinite(n) ? Math.max(-1e9, Math.min(1e9, n)) : fallback; }
  // Rounding keeps path strings short and, more importantly, finite: a NaN
  // coordinate would silently blank an entire path instead of one point.
  function r2(n) { return Math.round(n * 100) / 100; }
  var SERIES = ["accent", "wire", "success", "danger", "ink-muted"];
  function seriesPaint(i) { return "var(--kg-" + SERIES[i % SERIES.length] + ")"; }
  // Only the newer contract wrapper supplies this trusted function. Legacy
  // contracts keep positional paint; document JSON can never supply a function.
  function dataPaint(p, index, key) {
    return p && typeof p.__dataPaint === "function" ? p.__dataPaint(key) : seriesPaint(index);
  }
  function dataTable(label, head, rows, options) {
    return h("details", { className: "kg-chart-data", open: options && options.open }, h("summary", null, options && options.summary || "View chart data"),
      h("table", null, h("caption", null, label), h("thead", null, h("tr", null, head.map(function (t, i) { return h("th", { key: i }, t); }))),
        h("tbody", null, rows.map(function (row, i) { return h("tr", { key: i }, row.map(function (cell, j) { return h("td", { key: j }, cell); })); }))));
  }
  function emptyChart(p) { return h("figure", { className: "kg-scene" }, h("figcaption", null, p.label), h("p", null, p.empty || "No data to show")); }

  function CoreAreaChart(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && isFinite(it.x) && typeof it.x === "number" && typeof it.y === "number" && isFinite(it.y); }).slice(0, 2000);
    if (!items.length) return emptyChart(p);
    var xs = items.map(function (i) { return i.x; }), ys = items.map(function (i) { return i.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min(0, Math.min.apply(null, ys)), maxY = Math.max(0, Math.max.apply(null, ys));
    var sx = Math.max(Math.abs(minX), Math.abs(maxX), 1), sy = Math.max(Math.abs(minY), Math.abs(maxY), 1);
    var dx = maxX / sx - minX / sx, dy = maxY / sy - minY / sy;
    var pts = items.map(function (it) { return { x: r2(50 + (dx ? (it.x / sx - minX / sx) / dx : .5) * 530), y: r2(250 - (dy ? (it.y / sy - minY / sy) / dy : .5) * 210) }; });
    var base = r2(250 - (dy ? (0 - minY / sy) / dy : 0) * 210);
    var line = pts.map(function (pt, i) { return (i ? "L" : "M") + pt.x + " " + pt.y; }).join(" ");
    var area = line + " L" + pts[pts.length - 1].x + " " + base + " L" + pts[0].x + " " + base + " Z";
    return h("figure", { className: "kg-scene kg-scene--wide kg-area" }, h("figcaption", null, p.label),
      h("svg", { style: wideStyle(640), viewBox: "0 0 640 310", role: "img", "aria-label": p.label }, h("title", null, p.label),
        h("line", { x1: 50, y1: 250, x2: 580, y2: 250, stroke: "var(--kg-ink-muted)" }), h("line", { x1: 50, y1: 40, x2: 50, y2: 250, stroke: "var(--kg-ink-muted)" }),
        h("path", { d: area, fill: "var(--kg-accent)", fillOpacity: .22, stroke: "none" }), h("path", { d: line, fill: "none", stroke: "var(--kg-accent)", strokeWidth: 3 }),
        h("text", { x: 50, y: 285, fill: "var(--kg-ink)", fontSize: 12 }, String(minX)), h("text", { x: 540, y: 285, fill: "var(--kg-ink)", fontSize: 12 }, String(maxX)), h("text", { x: 4, y: 36, fill: "var(--kg-ink)", fontSize: 12 }, String(maxY))),
      dataTable(p.label, ["Label", p.xLabel || "X", p.yLabel || "Y"], items.map(function (it, i) { return [it.label || i + 1, it.x, it.y]; })));
  }

  // A full circle cannot be drawn as one SVG arc (start equals end), so a lone
  // 100% slice is capped just short of 360 degrees instead of vanishing.
  function ringSlice(cx, cy, ro, ri, a0, a1) {
    var sweep = Math.min(a1 - a0, Math.PI * 2 - .0001), e = a0 + sweep, big = sweep > Math.PI ? 1 : 0;
    function pt(r, a) { return r2(cx + r * Math.cos(a)) + " " + r2(cy + r * Math.sin(a)); }
    return "M" + pt(ro, a0) + " A" + ro + " " + ro + " 0 " + big + " 1 " + pt(ro, e) + " L" + pt(ri, e) + " A" + ri + " " + ri + " 0 " + big + " 0 " + pt(ri, a0) + " Z";
  }
  function CoreDonutChart(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.value === "number" && isFinite(it.value) && it.value > 0; }).slice(0, 12);
    var total = items.reduce(function (s, it) { return s + it.value; }, 0);
    if (!items.length || !isFinite(total) || total <= 0) return emptyChart(p);
    var angle = -Math.PI / 2, hole = p.hole === false ? 0 : 62, slices = items.map(function (it, i) {
      var a1 = angle + it.value / total * Math.PI * 2, d = ringSlice(110, 110, 100, hole, angle, a1); angle = a1;
      var chosen = p.selected === it.label, attrs = { key: i, d: d, fill: dataPaint(p, i, it.label), stroke: chosen ? "var(--kg-ink)" : "var(--kg-paper)", strokeWidth: chosen ? 4 : 2, opacity: p.selected && !chosen ? .45 : 1 };
      // Selection is data-out only: the slice reports its label, value and
      // position and the document decides what that filters.
      if (p.interactive) {
        var pick = function () { fire(p.onSelect, { label: String(it.label), value: it.value, index: i }); };
        attrs.role = "button"; attrs.tabIndex = 0; attrs["aria-pressed"] = chosen; attrs["aria-label"] = it.label + ": " + it.value; attrs.onClick = pick;
        attrs.onKeyDown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(); } };
      }
      return h("path", attrs, h("title", null, it.label + ": " + it.value));
    });
    return h("figure", { className: "kg-scene kg-donut" }, h("figcaption", null, p.label),
      h("div", { className: "kg-donut__body" }, h("svg", { viewBox: "0 0 220 220", role: "img", "aria-label": p.label }, h("title", null, p.label), slices,
        hole ? h("text", { x: 110, y: 118, textAnchor: "middle", fill: "var(--kg-ink)", fontSize: 28 }, String(r2(total))) : null),
        h("ul", { className: "kg-legend" }, items.map(function (it, i) { return h("li", { key: i }, h("span", { className: "kg-legend__swatch", style: { background: dataPaint(p, i, it.label) } }), it.label, h("span", { className: "kg-legend__value" }, Math.round(it.value / total * 100) + "%")); }))),
      dataTable(p.label, ["Label", "Value"], items.map(function (it) { return [it.label, it.value]; })));
  }

  function CoreGauge(p) {
    var min = richNum(p.min, 0), max = richNum(p.max, 100); if (max <= min) max = min + 1;
    var value = Math.max(min, Math.min(max, richNum(p.value, min))), t = (value - min) / (max - min);
    var tone = choice(p.tone, ["accent", "success", "danger", "wire"], "accent");
    // A half-ring runs left to right over the top: angle pi to 2pi.
    var track = ringSlice(110, 110, 100, 76, Math.PI, Math.PI * 2 - .0001), fill = t > 0 ? ringSlice(110, 110, 100, 76, Math.PI, Math.PI + Math.max(.0002, t * Math.PI)) : "";
    return h("figure", { className: "kg-scene kg-gauge" }, h("figcaption", null, p.label),
      h("svg", { viewBox: "0 0 220 130", role: "meter", "aria-label": p.label, "aria-valuemin": min, "aria-valuemax": max, "aria-valuenow": value }, h("title", null, p.label),
        h("path", { d: track, fill: "var(--kg-sunken)", stroke: "var(--kg-line)" }), fill ? h("path", { d: fill, fill: "var(--kg-" + tone + ")" }) : null,
        h("text", { x: 110, y: 108, textAnchor: "middle", fill: "var(--kg-ink)", fontSize: 30 }, String(r2(value)) + (p.unit ? " " + p.unit : ""))),
      h("p", { className: "kg-gauge__range" }, min + " – " + max));
  }

  function CoreSparkline(p) {
    var values = (Array.isArray(p.values) ? p.values : []).filter(function (n) { return typeof n === "number" && isFinite(n); }).slice(0, 500);
    if (values.length < 2) return h("span", { className: "kg-sparkline", role: "img", "aria-label": p.label }, "–");
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values), s = Math.max(Math.abs(min), Math.abs(max), 1), dy = max / s - min / s;
    var d = values.map(function (v, i) { return (i ? "L" : "M") + r2(i / (values.length - 1) * 118 + 1) + " " + r2(dy ? 29 - (v / s - min / s) / dy * 26 : 16); }).join(" ");
    return h("span", { className: "kg-sparkline" }, h("svg", { viewBox: "0 0 120 32", role: "img", "aria-label": p.label + ": " + values.join(", ") }, h("title", null, p.label), h("path", { d: d, fill: "none", stroke: "var(--kg-" + choice(p.tone, ["accent", "success", "danger", "wire"], "accent") + ")", strokeWidth: 2 })));
  }

  function CoreHeatmap(p) {
    var rows = (Array.isArray(p.rows) ? p.rows : []).slice(0, 60).map(String), cols = (Array.isArray(p.columns) ? p.columns : []).slice(0, 60).map(String);
    var grid = (Array.isArray(p.values) ? p.values : []).slice(0, rows.length);
    if (!rows.length || !cols.length) return emptyChart(p);
    var all = []; grid.forEach(function (r) { (Array.isArray(r) ? r : []).slice(0, cols.length).forEach(function (v) { if (typeof v === "number" && isFinite(v)) all.push(v); }); });
    var lo = all.length ? Math.min.apply(null, all) : 0, hi = all.length ? Math.max.apply(null, all) : 1, sc = Math.max(Math.abs(lo), Math.abs(hi), 1), span = hi / sc - lo / sc;
    return h("figure", { className: "kg-scene kg-heatmap" }, h("figcaption", null, p.label),
      h("div", { className: "kg-heatmap__scroll" }, h("table", { className: "kg-heatmap__table" }, h("thead", null, h("tr", null, h("th", null), cols.map(function (c, i) { return h("th", { key: i, scope: "col" }, c); }))),
        h("tbody", null, rows.map(function (r, i) {
          return h("tr", { key: i }, h("th", { scope: "row" }, r), cols.map(function (c, j) {
            var v = Array.isArray(grid[i]) ? grid[i][j] : undefined, ok = typeof v === "number" && isFinite(v);
            // Opacity (not a colour channel) carries the magnitude, so the cell
            // stays on the token palette and keeps text contrast via a floor.
            var cell = ok ? { background: "color-mix(in srgb, var(--kg-accent) " + Math.round(12 + (span ? (v / sc - lo / sc) / span : .5) * 78) + "%, var(--kg-paper))" } : undefined;
            var chosen = !!p.selected && p.selected.row === r && p.selected.column === c;
            if (p.interactive && ok) return h("td", { key: j, style: cell && cell.background ? cell : undefined, className: chosen ? "kg-heatmap__cell--on" : undefined }, h("button", { type: "button", className: "kg-heatmap__btn", "aria-pressed": chosen, title: r + " / " + c + ": " + v, onClick: function () { fire(p.onSelect, { row: r, column: c, value: v }); } }, v));
            return h("td", { key: j, style: cell, title: r + " / " + c + ": " + (ok ? v : "no data") }, ok ? v : "–");
          }));
        })))));
  }

  function CoreAlert(p) {
    var tone = choice(p.tone, ["info", "success", "warning", "danger"], "info");
    return h("div", { className: "kg-alert kg-alert--" + tone, role: tone === "danger" || tone === "warning" ? "alert" : "status" },
      p.title ? h("strong", { className: "kg-alert__title" }, p.title) : null, p.text ? h("p", { className: "kg-alert__text" }, p.text) : null, p.children && p.children.length ? h("div", { className: "kg-alert__content" }, p.children) : null);
  }

  function CoreAccordion(p) {
    var uid = R().useId(), items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.id === "string"; }).slice(0, 50);
    return h("div", { className: "kg-accordion" }, items.map(function (it, i) {
      var open = p.value === it.id, pid = uid + "-p" + i, bid = uid + "-b" + i;
      return h("div", { key: it.id, className: "kg-accordion__item" },
        h("h3", { className: "kg-accordion__heading" }, h("button", { id: bid, type: "button", className: "kg-accordion__trigger", "aria-expanded": open, "aria-controls": pid, onClick: function () { fire(p.onChange, { value: open ? "" : it.id }); } }, it.title, h("span", { "aria-hidden": "true", className: "kg-accordion__chev" }, open ? "–" : "+"))),
        h("div", { id: pid, role: "region", "aria-labelledby": bid, hidden: !open, className: "kg-accordion__panel" }, String(it.body == null ? "" : it.body)));
    }));
  }

  function CoreStepper(p) {
    var steps = (Array.isArray(p.steps) ? p.steps : []).filter(function (s) { return s && typeof s.id === "string"; }).slice(0, 20);
    var at = steps.findIndex(function (s) { return s.id === p.value; });
    return h("ol", { className: "kg-stepper", "aria-label": p.label }, steps.map(function (s, i) {
      var state = i < at ? "done" : i === at ? "current" : "todo", inner = [h("span", { key: "n", className: "kg-stepper__num", "aria-hidden": "true" }, state === "done" ? "✓" : i + 1), h("span", { key: "l", className: "kg-stepper__text" }, h("span", { className: "kg-stepper__label" }, s.label), s.description ? h("span", { className: "kg-stepper__desc" }, s.description) : null)];
      return h("li", { key: s.id, className: "kg-stepper__step kg-stepper__step--" + state, "aria-current": state === "current" ? "step" : undefined },
        p.interactive ? h("button", { type: "button", className: "kg-stepper__btn", onClick: function () { fire(p.onChange, { value: s.id }); } }, inner) : h("div", { className: "kg-stepper__btn" }, inner));
    }));
  }

  function CoreTimeline(p) {
    return h("ol", { className: "kg-timeline", "aria-label": p.label }, (Array.isArray(p.items) ? p.items : []).filter(Boolean).slice(0, 200).map(function (it, i) {
      return h("li", { key: i, className: "kg-timeline__item kg-timeline__item--" + choice(it.tone, ["neutral", "accent", "success", "danger"], "neutral") },
        it.time ? h("time", { className: "kg-timeline__time" }, String(it.time)) : null, h("strong", { className: "kg-timeline__title" }, String(it.title == null ? "" : it.title)), it.description ? h("p", { className: "kg-timeline__desc" }, String(it.description)) : null);
    }));
  }

  function CoreModal(p) {
    var ref = R().useRef(null), open = !!p.open;
    // Move focus into the dialog on open, otherwise keyboard users stay on a
    // page they can no longer see; restore it on close for the same reason.
    R().useEffect(function () {
      if (!open || !ref.current) return;
      var prev = document.activeElement; ref.current.focus();
      return function () { if (prev && prev.focus) prev.focus(); };
    }, [open]);
    if (!open) return null;
    function close() { fire(p.onChange, { open: false }); }
    return h("div", { className: "kg-modal", onClick: function (e) { if (e.target === e.currentTarget) close(); } },
      h("div", { ref: ref, className: "kg-modal__dialog", role: "dialog", "aria-modal": "true", "aria-label": p.label, tabIndex: -1, onKeyDown: function (e) { if (e.key === "Escape") { e.stopPropagation(); close(); } } },
        h("div", { className: "kg-modal__head" }, h("h2", { className: "kg-modal__title" }, p.label), h("button", { type: "button", className: "kg-modal__close", "aria-label": p.closeLabel || "Close", onClick: close }, "×")),
        h("div", { className: "kg-modal__body" }, p.children)));
  }

  var TONE4 = S("string", { enum: ["accent", "success", "danger", "wire"], default: "accent" });
  var XY_PROPS = { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { x: S("number"), y: S("number"), label: S("string") }, requiredKeys: ["x", "y"] }) }), xLabel: S("string"), yLabel: S("string"), empty: S("string") };
  var RICH = {
    "area-chart": { summary: "Responsive filled area chart of numeric X/Y data with an accessible data table.", props: XY_PROPS },
    "donut-chart": { summary: "Part-to-whole ring chart with a legend, percentages and an accessible data table.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number") }, requiredKeys: ["label", "value"] }) }), hole: S("boolean", { default: true }), empty: S("string"), interactive: S("boolean"), selected: S("string") }, local: { selected: { type: "string", default: "" } }, events: { select: { payload: { label: "string", value: "number", index: "number" } } }, outputs: ["selected"] },
    gauge: { summary: "Single value on a half-ring scale between a minimum and maximum.", props: { label: S("string", { required: true }), value: S("number", { required: true }), min: S("number", { default: 0 }), max: S("number", { default: 100 }), unit: S("string"), tone: TONE4 } },
    sparkline: { summary: "Tiny inline trend line for a series of numbers; sits next to a stat or in a table cell.", props: { label: S("string", { required: true }), values: S("array", { required: true, items: S("number") }), tone: TONE4 } },
    heatmap: { summary: "Row by column matrix whose cell shading shows magnitude, with every value readable as text.", props: { label: S("string", { required: true }), rows: S("array", { required: true, items: S("string") }), columns: S("array", { required: true, items: S("string") }), values: S("array", { required: true, items: S("array", { items: S("number") }) }), empty: S("string"), interactive: S("boolean"), selected: S("object") }, local: { selected: { type: "object|null", default: null } }, events: { select: { payload: { row: "string", column: "string", value: "number" } } }, outputs: ["selected"] },
    alert: { summary: "Inline callout for information, success, warning or danger with an optional title and content.", props: { tone: S("string", { enum: ["info", "success", "warning", "danger"], default: "info" }), title: S("string"), text: S("string") }, slots: { children: {} } },
    accordion: { summary: "Stack of headings that each reveal a panel; one open at a time with a public value.", props: { items: S("array", { required: true, items: S("object", { properties: { id: S("string"), title: S("string"), body: S("string") }, requiredKeys: ["id", "title"] }) }), value: S("string") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    stepper: { summary: "Ordered progress through named steps; optionally clickable, with the current step public.", props: { label: S("string", { required: true }), steps: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string"), description: S("string") }, requiredKeys: ["id", "label"] }) }), value: S("string"), interactive: S("boolean") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    timeline: { summary: "Chronological list of events with optional times, descriptions and tone.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { title: S("string"), time: S("string"), description: S("string"), tone: S("string", { enum: ["neutral", "accent", "success", "danger"] }) }, requiredKeys: ["title"] }) }) } },
    modal: { summary: "Dialog layered over the artifact; opened and closed by commands, Escape or the close button.", props: { label: S("string", { required: true }), open: S("boolean"), closeLabel: S("string") }, slots: { children: {} }, local: { open: { type: "boolean", default: false } }, events: { change: { payload: { open: "boolean" } } }, outputs: ["open"] }
  };
  var RICH_NOTES = {
    "area-chart": "items: [{x,y,label?}] with sorted x. Use for volume over time; prefer line-chart when several readings overlap.",
    "donut-chart": "items: [{label,value}] with positive values, at most 12 slices. Use for part-to-whole with few categories; use bar-chart to compare many. Set interactive to make slices selectable: select emits {label,value,index} and the public output `selected` is the label (empty = none); filter other blocks with $filter on it.",
    gauge: "value within min..max (clamped). tone is a token colour. Use for one KPI against a known scale, not for trends.",
    sparkline: "values: number[]; no axes. Put beside a stat for trend. Provide a label that states what the series is.",
    heatmap: "rows and columns are labels; values[row][column] numbers. Use for intensity across two categories. Missing cells show a dash. interactive makes cells buttons: select emits {row,column,value}; output `selected` is {row,column} or null.",
    alert: "tone info|success|warning|danger; title and text, or children. danger and warning announce immediately.",
    accordion: "items: [{id,title,body}]; value is the open id (empty closes all). change emits {value}. Use for FAQs and optional detail.",
    stepper: "steps: [{id,label,description?}]; value is the current id. interactive makes steps buttons; change emits {value}. Wire value to state to drive step content with visible.",
    timeline: "items: [{title,time?,description?,tone?}] in order. Use for history, roadmaps and activity logs.",
    modal: "Place content in children. Open with a button command {do:'call',target:modal,command:'open'}; Escape, the backdrop and the close button emit change {open:false}. Use sparingly for confirmations and detail."
  };
  Object.assign(freeFlowExports, { CoreAreaChart: CoreAreaChart, CoreDonutChart: CoreDonutChart, CoreGauge: CoreGauge, CoreSparkline: CoreSparkline, CoreHeatmap: CoreHeatmap, CoreAlert: CoreAlert, CoreAccordion: CoreAccordion, CoreStepper: CoreStepper, CoreTimeline: CoreTimeline, CoreModal: CoreModal });
  CMD.modal = { open: [{ do: "setLocal", key: "open", value: true }], close: [{ do: "setLocal", key: "open", value: false }], toggle: [{ do: "setLocal", key: "open", value: { $not: { $self: "open" } } }] };
  Object.keys(RICH).forEach(function (name) {
    var I = RICH[name]; I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "accordion" || name === "stepper") DEFAULTS[name] = { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] };
    if (name === "donut-chart") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $if: [{ $eq: [{ $self: "selected" }, { $event: "label" }] }, "", { $event: "label" }] } }] };
    if (name === "heatmap") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { row: { $event: "row" }, column: { $event: "column" } } }] };
    if (name === "modal") DEFAULTS[name] = { change: [{ do: "setLocal", key: "open", value: { $event: "open" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    // Adding the optional select event/output to these two is a minor contract change.
    core[name] = contract("core", name, name === "donut-chart" || name === "heatmap" ? "1.1.0" : "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "wire", "success", "danger", "focus"], agent: { use: RICH_NOTES[name] } });
  });
