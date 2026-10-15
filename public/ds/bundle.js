/* @ds-bundle: {"format":4,"namespace":"Kages","components":[{"name":"CoreShell"},{"name":"CoreSidebar"},{"name":"CoreDropdown"},{"name":"CoreTabs"},{"name":"CoreButton"},{"name":"CoreTextInput"},{"name":"CoreCard"},{"name":"CoreStack"},{"name":"CoreText"},{"name":"CoreBadge"},{"name":"CoreStat"},{"name":"CoreTable"},{"name":"LedgerSidebar"},{"name":"LedgerDropdown"},{"name":"LedgerTabs"},{"name":"LedgerButton"},{"name":"LedgerCard"},{"name":"LedgerStat"},{"name":"AtelierSidebar"},{"name":"AtelierDropdown"},{"name":"AtelierTabs"},{"name":"AtelierButton"},{"name":"AtelierCard"},{"name":"AtelierStat"},{"name":"KageRenderer"},{"name":"CorePage"},{"name":"CoreSection"},{"name":"CoreGrid"},{"name":"CoreSplit"},{"name":"CoreImage"},{"name":"CoreCode"},{"name":"CoreList"},{"name":"CoreDivider"},{"name":"CoreTextarea"},{"name":"CoreSlider"},{"name":"CoreCheckbox"},{"name":"CoreBarChart"},{"name":"CoreComposition"},{"name":"CoreLink"},{"name":"CoreRichText"},{"name":"CoreTextField"},{"name":"CoreNumberInput"},{"name":"CoreDateInput"},{"name":"CoreChoice"},{"name":"CoreMultiselect"},{"name":"CoreForm"},{"name":"CoreScene"},{"name":"CoreDiagram"},{"name":"CoreLineChart"},{"name":"CoreScatterChart"},{"name":"CoreAreaChart"},{"name":"CoreDonutChart"},{"name":"CoreGauge"},{"name":"CoreSparkline"},{"name":"CoreHeatmap"},{"name":"CoreAlert"},{"name":"CoreAccordion"},{"name":"CoreStepper"},{"name":"CoreTimeline"},{"name":"CoreModal"}]} */
/*
 * Kages reference bundle.
 *   - 3 design systems (core, ledger, atelier) = token scope + component map
 *   - 24 component implementations, each with a machine-readable contract
 *   - 12 shared interfaces (kages/<role>@1) that make blocks portable across systems
 *   - KageRenderer: renders a Kage document (blocks + refs + state + actions)
 *   - validate(): static checks an agent runs before publishing a Kage
 * Plain classic script; reads window.React at call time; assigns window.Kages.
 */
(function () {
  "use strict";
  var W = window;
  function R() { return W.React; }
  function h() { var r = R(); return r.createElement.apply(r, arguments); }
  function cx() { var o = []; for (var i = 0; i < arguments.length; i++) if (arguments[i]) o.push(arguments[i]); return o.join(" "); }
  function fire(fn, payload) { if (typeof fn === "function") fn(payload || {}); }
  function initials(s) { s = String(s || "?"); var p = s.split(/\s+/); return (p.length > 1 ? p[0][0] + p[1][0] : s.slice(0, 2)).toUpperCase(); }
  function fmt(v, f) {
    if (v == null || v === "") return "";
    if (f === "number" && typeof v === "number") return v.toLocaleString("en-US");
    if (f === "currency" && typeof v === "number") return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    if (f === "percent" && typeof v === "number") return (v * 100).toFixed(1) + "%";
    return String(v);
  }
  function Chevron(p) {
    return h("svg", { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": "true", className: p.className, style: p.style },
      h("path", { d: p.dir === "left" ? "M7.5 2.5 4 6l3.5 3.5" : p.dir === "right" ? "M4.5 2.5 8 6 4.5 9.5" : "M2.5 4.5 6 8l3.5-3.5", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" }));
  }
  function useOutside(ref, open, close) {
    R().useEffect(function () {
      if (!open) return;
      function on(e) { if (ref.current && !ref.current.contains(e.target)) close(); }
      document.addEventListener("mousedown", on);
      return function () { document.removeEventListener("mousedown", on); };
    }, [open]);
  }
  var GAP = { "0": "0", "1": "var(--space-1)", "2": "var(--space-2)", "3": "var(--space-3)", "4": "var(--space-4)", "6": "var(--space-6)", "8": "var(--space-8)" };

  /* ============================== CORE ============================== */

  function CoreShell(p) {
    return h("div", { className: cx("kg-shell", p.className) },
      p.sidebar && p.sidebar.length ? h("div", { className: "kg-shell__side" }, p.sidebar) : null,
      h("div", { className: "kg-shell__body" },
        p.header && p.header.length ? h("header", { className: "kg-shell__header" }, p.header) : null,
        h("main", { className: "kg-shell__main" }, p.main || p.children)));
  }

  function CoreSidebar(p) {
    var items = p.items || [], collapsed = !!p.collapsed;
    return h("nav", { className: cx("kg-side", collapsed && "is-collapsed"), "aria-label": p.title || "Navigation" },
      h("div", { className: "kg-side__head" },
        collapsed ? null : h("span", { className: "kg-side__title" }, p.title),
        h("button", { type: "button", className: "kg-iconbtn", "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar", "aria-expanded": !collapsed, onClick: function () { fire(p.onToggle); } },
          h(Chevron, { dir: collapsed ? "right" : "left" }))),
      h("ul", { className: "kg-side__list", role: "list" }, items.map(function (it) {
        var on = it.id === p.value;
        return h("li", { key: it.id },
          h("button", { type: "button", className: cx("kg-side__item", on && "is-active"), "aria-current": on ? "page" : undefined, title: collapsed ? it.label : undefined, onClick: function () { fire(p.onSelect, { id: it.id }); } },
            h("span", { className: "kg-side__mono", "aria-hidden": "true" }, initials(it.label)),
            collapsed ? null : h("span", { className: "kg-side__label" }, it.label),
            !collapsed && it.badge != null ? h("span", { className: "kg-side__badge" }, it.badge) : null));
      })));
  }

  function CoreDropdown(p) {
    var r = R(), st = r.useState(false), open = st[0], setOpen = st[1];
    var hl = r.useState(0), hi = hl[0], setHi = hl[1];
    var ref = r.useRef(null), idRef = r.useRef("kg-dd-" + Math.random().toString(36).slice(2, 8));
    var opts = p.options || [];
    var sel = null; for (var i = 0; i < opts.length; i++) if (opts[i].value === p.value) sel = opts[i];
    useOutside(ref, open, function () { setOpen(false); });
    function pick(o) { setOpen(false); fire(p.onChange, { value: o.value, label: o.label }); }
    function key(e) {
      if (p.disabled) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!open) { setOpen(true); return; } setHi((hi + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length); }
      else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (open && opts[hi]) pick(opts[hi]); else setOpen(true); }
      else if (e.key === "Escape") setOpen(false);
    }
    return h("div", { className: "kg-field kg-dd", ref: ref },
      p.label ? h("label", { className: "kg-field__label", id: idRef.current + "-l" }, p.label) : null,
      h("button", { type: "button", className: cx("kg-dd__trigger", open && "is-open"), disabled: p.disabled, "aria-haspopup": "listbox", "aria-expanded": open, "aria-labelledby": p.label ? idRef.current + "-l" : undefined, onClick: function () { setOpen(!open); }, onKeyDown: key },
        h("span", { className: cx("kg-dd__value", !sel && "is-placeholder") }, sel ? sel.label : (p.placeholder || "Select…")),
        h(Chevron, { className: "kg-dd__chev" })),
      open ? h("ul", { className: "kg-dd__menu", role: "listbox" }, opts.map(function (o, i) {
        return h("li", { key: o.value, role: "option", "aria-selected": o.value === p.value, className: cx("kg-dd__opt", i === hi && "is-hi", o.value === p.value && "is-sel"), onMouseEnter: function () { setHi(i); }, onMouseDown: function (e) { e.preventDefault(); pick(o); } },
          h("span", null, o.label), o.hint ? h("span", { className: "kg-dd__hint" }, o.hint) : null);
      })) : null);
  }

  function CoreTabs(p) {
    var tabs = p.tabs || [];
    return h("div", { className: "kg-tabs", role: "tablist" }, tabs.map(function (t) {
      var on = t.id === p.value;
      return h("button", { key: t.id, type: "button", role: "tab", "aria-selected": on, className: cx("kg-tab", on && "is-active"), onClick: function () { fire(p.onChange, { id: t.id }); } },
        t.label, t.count != null ? h("span", { className: "kg-tab__count" }, t.count) : null);
    }));
  }

  function CoreButton(p) {
    return h("button", { type: "button", className: cx("kg-btn", "kg-btn--" + (p.variant || "secondary"), p.size === "sm" && "kg-btn--sm"), disabled: p.disabled, onClick: function () { fire(p.onClick); } }, p.label != null ? p.label : p.children);
  }

  function CoreTextInput(p) {
    return h("label", { className: "kg-field" },
      p.label ? h("span", { className: "kg-field__label" }, p.label) : null,
      h("input", { className: "kg-input", type: p.inputType || "text", value: p.value == null ? "" : p.value, placeholder: p.placeholder, disabled: p.disabled, onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }),
      p.help ? h("span", { className: "kg-field__help" }, p.help) : null);
  }

  function CoreCard(p) {
    return h("section", { className: cx("kg-card", p.tone && "kg-card--" + p.tone) },
      p.title || (p.actions && p.actions.length) ? h("div", { className: "kg-card__head" },
        h("div", null, p.title ? h("h3", { className: "kg-card__title" }, p.title) : null, p.subtitle ? h("p", { className: "kg-card__sub" }, p.subtitle) : null),
        p.actions && p.actions.length ? h("div", { className: "kg-card__actions" }, p.actions) : null) : null,
      h("div", { className: "kg-card__body" }, p.children));
  }

  function CoreStack(p) {
    var st = { display: "flex", flexDirection: p.direction === "row" ? "row" : "column", gap: GAP[String(p.gap == null ? 4 : p.gap)] || GAP["4"], alignItems: p.align || (p.direction === "row" ? "center" : "stretch"), justifyContent: p.justify || "flex-start", flexWrap: p.wrap ? "wrap" : "nowrap" };
    if (p.columns) { st = { display: "grid", gridTemplateColumns: "repeat(" + p.columns + ", minmax(0, 1fr))", gap: st.gap }; }
    return h("div", { className: "kg-stack", style: st }, p.children);
  }

  function CoreText(p) {
    var v = p.variant || "body", tag = { display: "h1", title: "h2", heading: "h3" }[v] || (v === "code" ? "code" : "p");
    return h(tag, { className: "kg-text kg-text--" + v }, p.text != null ? p.text : p.children);
  }

  function CoreBadge(p) { return h("span", { className: "kg-badge kg-badge--" + (p.tone || "neutral") }, p.label != null ? p.label : p.children); }

  function CoreStat(p) {
    var d = p.delta, up = typeof d === "number" ? d >= 0 : null;
    return h("div", { className: "kg-stat" },
      h("span", { className: "kg-stat__label" }, p.label),
      h("span", { className: "kg-stat__value" }, fmt(p.value, p.format)),
      d != null ? h("span", { className: cx("kg-stat__delta", up === true && "is-up", up === false && "is-down") }, typeof d === "number" ? (d >= 0 ? "+" : "") + (d * 100).toFixed(1) + "%" : d) : null,
      p.caption ? h("span", { className: "kg-stat__cap" }, p.caption) : null);
  }

  function CoreTable(p) {
    var cols = p.columns || [], rows = p.rows || [];
    return h("div", { className: "kg-tablewrap" },
      h("table", { className: cx("kg-table", p.dense && "is-dense") },
        h("thead", null, h("tr", null, cols.map(function (c) { return h("th", { key: c.key, style: { textAlign: c.align || "left" } }, c.label); }))),
        h("tbody", null, rows.length ? rows.map(function (row, i) {
          return h("tr", { key: row.id != null ? row.id : i, onClick: p.onRowSelect ? function () { fire(p.onRowSelect, { row: row, index: i }); } : undefined, className: p.onRowSelect ? "is-clickable" : undefined },
            cols.map(function (c) { return h("td", { key: c.key, style: { textAlign: c.align || "left" } }, fmt(row[c.key], c.format)); }));
        }) : h("tr", null, h("td", { colSpan: cols.length || 1, className: "kg-table__empty" }, p.empty || "Nothing to show")))));
  }

  /* ============================== LEDGER ============================== */

  function LedgerSidebar(p) {
    var items = p.items || [], collapsed = !!p.collapsed, groups = [], seen = {};
    items.forEach(function (it) { var g = it.group || ""; if (!seen[g]) { seen[g] = []; groups.push(g); } seen[g].push(it); });
    return h("nav", { className: cx("lg-side", collapsed && "is-collapsed"), "aria-label": p.title || "Navigation" },
      h("div", { className: "lg-side__head" },
        collapsed ? null : h("span", { className: "lg-side__title" }, p.title),
        h("button", { type: "button", className: "lg-side__toggle", "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar", "aria-expanded": !collapsed, onClick: function () { fire(p.onToggle); } }, collapsed ? "»" : "«")),
      groups.map(function (g) {
        return h("div", { key: g || "_", className: "lg-side__group" },
          g && !collapsed ? h("div", { className: "lg-side__glabel" }, g) : null,
          seen[g].map(function (it) {
            var on = it.id === p.value;
            return h("button", { key: it.id, type: "button", className: cx("lg-side__row", on && "is-active"), "aria-current": on ? "page" : undefined, title: collapsed ? it.label : undefined, onClick: function () { fire(p.onSelect, { id: it.id }); } },
              h("span", { className: "lg-side__code" }, it.code || initials(it.label)),
              collapsed ? null : h("span", { className: "lg-side__label" }, it.label),
              !collapsed && it.badge != null ? h("span", { className: "lg-side__count" }, it.badge) : null);
          }));
      }));
  }

  function LedgerDropdown(p) {
    var opts = p.options || [];
    return h("div", { className: "lg-seg-field" },
      p.label ? h("span", { className: "lg-seg__label" }, p.label) : null,
      h("div", { className: "lg-seg", role: "radiogroup", "aria-label": p.label }, opts.map(function (o) {
        var on = o.value === p.value;
        return h("button", { key: o.value, type: "button", role: "radio", "aria-checked": on, disabled: p.disabled, className: cx("lg-seg__opt", on && "is-on"), onClick: function () { fire(p.onChange, { value: o.value, label: o.label }); } }, o.label);
      })));
  }

  function LedgerTabs(p) {
    return h("div", { className: "lg-tabs", role: "tablist" }, (p.tabs || []).map(function (t) {
      var on = t.id === p.value;
      return h("button", { key: t.id, type: "button", role: "tab", "aria-selected": on, className: cx("lg-tab", on && "is-active"), onClick: function () { fire(p.onChange, { id: t.id }); } },
        t.label, t.count != null ? h("span", { className: "lg-tab__count" }, "[" + t.count + "]") : null);
    }));
  }

  function LedgerButton(p) {
    return h("button", { type: "button", className: cx("lg-btn", "lg-btn--" + (p.variant || "secondary"), p.size === "sm" && "lg-btn--sm"), disabled: p.disabled, onClick: function () { fire(p.onClick); } },
      h("span", null, p.label != null ? p.label : p.children), p.kbd ? h("kbd", { className: "lg-btn__kbd" }, p.kbd) : null);
  }

  function LedgerCard(p) {
    return h("section", { className: "lg-card" },
      h("div", { className: "lg-card__bar" },
        p.code ? h("span", { className: "lg-card__code" }, p.code) : null,
        h("span", { className: "lg-card__title" }, p.title),
        p.subtitle ? h("span", { className: "lg-card__sub" }, p.subtitle) : null,
        p.actions && p.actions.length ? h("span", { className: "lg-card__actions" }, p.actions) : null),
      h("div", { className: "lg-card__body" }, p.children));
  }

  function Spark(p) {
    var t = p.trend || []; if (t.length < 2) return null;
    var mn = Math.min.apply(null, t), mx = Math.max.apply(null, t), w = 96, hgt = 28, rg = mx - mn || 1;
    var pts = t.map(function (v, i) { return (i / (t.length - 1) * w).toFixed(1) + "," + (hgt - 2 - (v - mn) / rg * (hgt - 4)).toFixed(1); }).join(" ");
    return h("svg", { className: "lg-stat__spark", width: w, height: hgt, viewBox: "0 0 " + w + " " + hgt, "aria-hidden": "true" }, h("polyline", { points: pts, fill: "none", stroke: "currentColor", strokeWidth: 1.5 }));
  }

  function LedgerStat(p) {
    var d = p.delta, up = typeof d === "number" ? d >= 0 : null;
    return h("div", { className: "lg-stat" },
      h("div", { className: "lg-stat__top" }, h("span", { className: "lg-stat__label" }, p.label), d != null ? h("span", { className: cx("lg-stat__delta", up === true && "is-up", up === false && "is-down") }, typeof d === "number" ? (d >= 0 ? "▲ " : "▼ ") + Math.abs(d * 100).toFixed(1) + "%" : d) : null),
      h("div", { className: "lg-stat__row" }, h("span", { className: "lg-stat__value" }, fmt(p.value, p.format)), h(Spark, { trend: p.trend })),
      p.caption ? h("span", { className: "lg-stat__cap" }, p.caption) : null);
  }

  /* ============================== ATELIER ============================== */

  function AtelierSidebar(p) {
    var items = p.items || [], collapsed = !!p.collapsed;
    return h("nav", { className: cx("at-side", collapsed && "is-collapsed"), "aria-label": p.title || "Navigation" },
      h("div", { className: "at-side__head" },
        collapsed ? null : h("span", { className: "at-side__title" }, p.title),
        h("button", { type: "button", className: "at-side__toggle", "aria-label": collapsed ? "Expand sidebar" : "Collapse sidebar", "aria-expanded": !collapsed, onClick: function () { fire(p.onToggle); } }, h(Chevron, { dir: collapsed ? "right" : "left" }))),
      h("ul", { className: "at-side__list", role: "list" }, items.map(function (it) {
        var on = it.id === p.value;
        return h("li", { key: it.id },
          h("button", { type: "button", className: cx("at-side__item", on && "is-active"), "aria-current": on ? "page" : undefined, title: collapsed ? it.label : undefined, onClick: function () { fire(p.onSelect, { id: it.id }); } },
            h("span", { className: "at-side__dot", "aria-hidden": "true" }, initials(it.label).slice(0, 1)),
            collapsed ? null : h("span", { className: "at-side__text" }, h("span", { className: "at-side__label" }, it.label), it.description ? h("span", { className: "at-side__desc" }, it.description) : null)));
      })));
  }

  function AtelierDropdown(p) {
    var opts = p.options || [];
    return h("div", { className: "at-chips-field" },
      p.label ? h("span", { className: "at-chips__label" }, p.label) : null,
      h("div", { className: "at-chips", role: "radiogroup", "aria-label": p.label }, opts.map(function (o) {
        var on = o.value === p.value;
        return h("button", { key: o.value, type: "button", role: "radio", "aria-checked": on, disabled: p.disabled, className: cx("at-chip", on && "is-on"), onClick: function () { fire(p.onChange, { value: o.value, label: o.label }); } },
          on ? h("svg", { width: 12, height: 12, viewBox: "0 0 12 12", "aria-hidden": "true" }, h("path", { d: "M2.5 6.2 5 8.5l4.5-5", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" })) : null,
          o.label);
      })));
  }

  function AtelierTabs(p) {
    return h("div", { className: "at-tabs", role: "tablist" }, (p.tabs || []).map(function (t) {
      var on = t.id === p.value;
      return h("button", { key: t.id, type: "button", role: "tab", "aria-selected": on, className: cx("at-tab", on && "is-active"), onClick: function () { fire(p.onChange, { id: t.id }); } }, t.label, t.count != null ? h("span", { className: "at-tab__count" }, t.count) : null);
    }));
  }

  function AtelierButton(p) {
    return h("button", { type: "button", className: cx("at-btn", "at-btn--" + (p.variant || "secondary"), p.size === "sm" && "at-btn--sm"), disabled: p.disabled, onClick: function () { fire(p.onClick); } }, p.label != null ? p.label : p.children);
  }

  function AtelierCard(p) {
    return h("section", { className: cx("at-card", p.tone && "at-card--" + p.tone) },
      p.eyebrow ? h("span", { className: "at-card__eyebrow" }, p.eyebrow) : null,
      p.title ? h("h3", { className: "at-card__title" }, p.title) : null,
      p.subtitle ? h("p", { className: "at-card__sub" }, p.subtitle) : null,
      h("div", { className: "at-card__body" }, p.children),
      p.actions && p.actions.length ? h("div", { className: "at-card__actions" }, p.actions) : null);
  }

  function AtelierStat(p) {
    var d = p.delta, up = typeof d === "number" ? d >= 0 : null;
    return h("div", { className: "at-stat" },
      h("span", { className: "at-stat__value" }, fmt(p.value, p.format)),
      h("span", { className: "at-stat__label" }, p.label),
      d != null ? h("span", { className: cx("at-stat__delta", up === false && "is-down") }, typeof d === "number" ? (d >= 0 ? "Up " : "Down ") + Math.abs(d * 100).toFixed(1) + "%" : d) : null,
      p.caption ? h("p", { className: "at-stat__cap" }, p.caption) : null);
  }

  /* ============================== INTERFACES ============================== */
  /* An interface is the portable part of a contract. A block that only uses interface
     props/events/outputs renders in every system that maps that role. */
  var S = function (type, extra) { var o = { type: type }; for (var k in extra) o[k] = extra[k]; return o; };
  var OPTION = S("object", { properties: { value: S("string"), label: S("string"), hint: S("string") }, requiredKeys: ["value", "label"] });
  var NAVITEM = S("object", { properties: { id: S("string"), label: S("string"), badge: S("string|number"), group: S("string"), code: S("string"), description: S("string") }, requiredKeys: ["id", "label"] });
  var TAB = S("object", { properties: { id: S("string"), label: S("string"), count: S("number") }, requiredKeys: ["id", "label"] });
  var COLUMN = S("object", { properties: { key: S("string"), label: S("string"), align: S("string", { enum: ["left", "right", "center"] }), format: S("string", { enum: ["text", "number", "currency", "percent"] }) }, requiredKeys: ["key", "label"] });

  var interfaces = {
    "kages/shell@1": { role: "shell", summary: "App frame with sidebar, header and main regions.", props: {}, slots: { sidebar: { max: 1 }, header: {}, main: { required: true } }, events: {}, outputs: [] },
    "kages/nav@1": { role: "nav", summary: "Collapsible navigation list; one active item.", props: { title: S("string"), items: S("array", { items: NAVITEM, required: true }), value: S("string") }, local: { collapsed: { type: "boolean", default: false }, value: { type: "string", default: null } }, events: { select: { payload: { id: "string" } }, toggle: { payload: {} } }, commands: ["toggle", "collapse", "expand"], outputs: ["value", "collapsed"] },
    "kages/select@1": { role: "select", summary: "Pick exactly one value from a short list.", props: { label: S("string"), options: S("array", { items: OPTION, required: true }), value: S("string"), placeholder: S("string"), disabled: S("boolean") }, local: { value: { type: "string", default: null } }, events: { change: { payload: { value: "string", label: "string" } } }, commands: ["clear"], outputs: ["value"] },
    "kages/tabs@1": { role: "tabs", summary: "Switch between sibling views.", props: { tabs: S("array", { items: TAB, required: true }), value: S("string") }, local: { value: { type: "string", default: null } }, events: { change: { payload: { id: "string" } } }, commands: [], outputs: ["value"] },
    "kages/button@1": { role: "button", summary: "Trigger one action.", props: { label: S("string", { required: true }), variant: S("string", { enum: ["primary", "secondary", "quiet", "danger"], default: "secondary" }), size: S("string", { enum: ["md", "sm"], default: "md" }), disabled: S("boolean") }, events: { click: { payload: {} } }, commands: [], outputs: [] },
    "kages/text-input@1": { role: "text-input", summary: "Single-line free text.", props: { label: S("string"), value: S("string"), placeholder: S("string"), help: S("string"), inputType: S("string", { enum: ["text", "email", "number", "search"] }), disabled: S("boolean") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, commands: ["clear"], outputs: ["value"] },
    "kages/card@1": { role: "card", summary: "Titled container for related content.", props: { title: S("string"), subtitle: S("string") }, slots: { children: {}, actions: {} }, events: {}, outputs: [] },
    "kages/stack@1": { role: "stack", summary: "Lay children out in a row, column or grid.", props: { direction: S("string", { enum: ["row", "column"], default: "column" }), gap: S("string|number", { enum: [0, 1, 2, 3, 4, 6, 8], default: 4 }), columns: S("number"), align: S("string"), justify: S("string"), wrap: S("boolean") }, slots: { children: {} }, events: {}, outputs: [] },
    "kages/text@1": { role: "text", summary: "A run of text in one type style.", props: { text: S("string", { required: true }), variant: S("string", { enum: ["display", "title", "heading", "body", "muted", "caption", "code"], default: "body" }) }, events: {}, outputs: [] },
    "kages/badge@1": { role: "badge", summary: "Short status label.", props: { label: S("string", { required: true }), tone: S("string", { enum: ["neutral", "accent", "success", "danger", "wire"], default: "neutral" }) }, events: {}, outputs: [] },
    "kages/stat@1": { role: "stat", summary: "One headline number with context.", props: { label: S("string", { required: true }), value: S("number|string", { required: true }), format: S("string", { enum: ["text", "number", "currency", "percent"] }), delta: S("number|string"), caption: S("string") }, events: {}, outputs: [] },
    "kages/table@1": { role: "table", summary: "Rows of records under typed columns.", props: { columns: S("array", { items: COLUMN, required: true }), rows: S("array", { required: true }), empty: S("string"), dense: S("boolean") }, events: { rowSelect: { payload: { row: "object", index: "number" } } }, commands: [], outputs: ["rows"] }
  };

  /* ============================== CONTRACTS ============================== */
  function merge(a, b) { var o = {}, k; for (k in a) o[k] = a[k]; for (k in b) o[k] = b[k]; return o; }
  var HANDLER = { select: "onSelect", toggle: "onToggle", change: "onChange", click: "onClick", rowSelect: "onRowSelect" };
  var CMD = {
    nav: { toggle: [{ do: "setLocal", key: "collapsed", value: { $not: { $self: "collapsed" } } }], collapse: [{ do: "setLocal", key: "collapsed", value: true }], expand: [{ do: "setLocal", key: "collapsed", value: false }] },
    select: { clear: [{ do: "setLocal", key: "value", value: null }] },
    "text-input": { clear: [{ do: "setLocal", key: "value", value: "" }] }
  };
  var DEFAULTS = {
    nav: { select: [{ do: "setLocal", key: "value", value: { $event: "id" } }], toggle: [{ do: "call", target: "$self", command: "toggle" }] },
    select: { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] },
    tabs: { change: [{ do: "setLocal", key: "value", value: { $event: "id" } }] },
    "text-input": { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] }
  };

  function contract(sys, name, version, iface, impl, extra) {
    var I = interfaces[iface];
    var ev = {}; for (var e in I.events) ev[e] = { handler: HANDLER[e], payload: I.events[e].payload };
    var c = {
      $contract: "kages.contract/1", id: sys + "/" + name, version: version, ref: sys + "/" + name + "@" + version,
      system: sys, name: name, implements: [iface], role: I.role, summary: I.summary,
      props: merge(I.props, (extra && extra.props) || {}), slots: I.slots || {}, local: I.local || {},
      events: ev, commands: CMD[I.role] || {}, defaults: DEFAULTS[I.role] || {}, outputs: I.outputs || [],
      tokens: (extra && extra.tokens) || [], agent: (extra && extra.agent) || {}, limits: (extra && extra.limits) || {}
    };
    contracts[c.ref] = c; impls[c.ref] = impl; return c.ref;
  }
  var contracts = {}, impls = {};

  var core = {
    shell: contract("core", "shell", "1.0.0", "kages/shell@1", CoreShell, { tokens: ["paper", "sunken", "line"], agent: { use: "Root block of any multi-region artifact. Put exactly one nav in `sidebar`.", avoid: "Nesting shells." } }),
    sidebar: contract("core", "sidebar", "1.2.0", "kages/nav@1", CoreSidebar, { tokens: ["sunken", "line", "ink", "ink-muted", "accent", "accent-soft"], agent: { use: "Primary navigation between 3–9 sections. Bind `value` to a state key and read it from content blocks with `visible`.", avoid: "More than 9 items; put nested content in tabs instead." } }),
    dropdown: contract("core", "dropdown", "1.3.0", "kages/select@1", CoreDropdown, { tokens: ["surface", "line-control", "ink", "accent-soft", "shadow-pop"], agent: { use: "Any single choice; scales to long option lists.", avoid: "Two options — use a button pair." } }),
    tabs: contract("core", "tabs", "1.0.0", "kages/tabs@1", CoreTabs, { tokens: ["line", "ink", "ink-muted", "accent"], agent: { use: "2–6 sibling views inside one section.", avoid: "Top-level navigation (that is the sidebar's job)." } }),
    button: contract("core", "button", "1.1.0", "kages/button@1", CoreButton, { tokens: ["accent", "accent-ink", "surface", "line-control", "danger"], agent: { use: "One primary per region; labels are verbs.", avoid: "Using a button to show state." } }),
    "text-input": contract("core", "text-input", "1.0.0", "kages/text-input@1", CoreTextInput, { tokens: ["surface", "line-control", "focus"], agent: { use: "Search boxes, names, short answers.", avoid: "Choices from a known list — use dropdown." } }),
    card: contract("core", "card", "1.0.0", "kages/card@1", CoreCard, { props: { tone: S("string", { enum: ["default", "sunken"] }) }, tokens: ["surface", "line", "radius-lg"], agent: { use: "Group one topic's content; header actions go in the `actions` slot.", avoid: "Cards inside cards." } }),
    stack: contract("core", "stack", "1.0.0", "kages/stack@1", CoreStack, { tokens: ["space-1", "space-2", "space-3", "space-4", "space-6", "space-8"], agent: { use: "All layout. `columns` switches to an even grid.", avoid: "Pixel values; gap is a spacing step." } }),
    text: contract("core", "text", "1.0.0", "kages/text@1", CoreText, { tokens: ["ink", "ink-muted"], agent: { use: "Headings and prose. Use `$tpl` for text that reads state.", avoid: "Long documents; that is a Docs artifact." } }),
    badge: contract("core", "badge", "1.0.0", "kages/badge@1", CoreBadge, { tokens: ["accent-soft", "wire-soft", "danger-soft", "sunken"], agent: { use: "Status next to a title or row.", avoid: "Interactive filters." } }),
    stat: contract("core", "stat", "1.0.0", "kages/stat@1", CoreStat, { tokens: ["ink", "ink-muted", "success", "danger"], agent: { use: "3–4 KPIs in a stack with `columns`. Feed `value` with `$count`/`$sum` over data.", avoid: "More than 6 in a row." } }),
    table: contract("core", "table", "1.0.0", "kages/table@1", CoreTable, { tokens: ["surface", "line", "sunken"], agent: { use: "Records; bind `rows` to `$filter` over a data source for interactive filtering.", avoid: "Over ~200 rows without paging." } })
  };
/* Additional portable contracts run inside the reference bundle's closure.
 * Composition stays data: bounded design choices become classes, while text,
 * code and labels remain React text nodes. See oracle/free-flow.feature. */

  function choice(value, values, fallback) { return values.indexOf(value) >= 0 ? value : fallback; }
  function space(value, fallback) { return choice(value, [0, 1, 2, 3, 4, 6, 8], fallback); }
  function spacingProps(p) { return { "--kg-layout-gap": "var(--kg-space-" + space(p.gap, 4) + ")", "--kg-layout-inset": "var(--kg-space-" + space(p.inset, 6) + ")" }; }

  function CorePage(p) {
    return h("div", { className: "kg-page kg-page--" + choice(p.width, ["reading", "wide", "full"], "wide"), style: spacingProps(p) },
      p.header && p.header.length ? h("header", { className: "kg-page__header" }, p.header) : null,
      h("main", { className: "kg-page__content" }, p.children),
      p.footer && p.footer.length ? h("footer", { className: "kg-page__footer" }, p.footer) : null);
  }

  function CoreSection(p) {
    var level = choice(p.level, [2, 3, 4], 2);
    return h("section", { className: "kg-section kg-section--" + choice(p.tone, ["plain", "surface", "sunken", "accent"], "plain"), style: spacingProps(p), "aria-label": p.title || undefined },
      p.eyebrow ? h("p", { className: "kg-section__eyebrow" }, p.eyebrow) : null,
      p.title ? h("h" + level, { className: "kg-section__title" }, p.title) : null,
      p.description ? h("p", { className: "kg-section__description" }, p.description) : null,
      h("div", { className: "kg-section__content" }, p.children),
      p.actions && p.actions.length ? h("div", { className: "kg-section__actions" }, p.actions) : null);
  }

  function CoreGrid(p) {
    var styles = spacingProps(p);
    // The readable minimum card size already bounds rendered track count;
    // agents can request five or eight columns without needing another preset.
    styles["--kg-columns"] = typeof p.columns === "number" && isFinite(p.columns) && p.columns >= 1 ? Math.floor(p.columns) : 3;
    return h("div", { className: "kg-grid", style: styles },
      h("div", { className: "kg-grid__items kg-grid__items--" + choice(p.minSize, ["small", "medium", "large"], "medium") }, p.children));
  }

  function CoreSplit(p) {
    return h("div", { className: "kg-split", style: spacingProps(p) },
      h("div", { className: "kg-split__items kg-split__items--" + choice(p.ratio, ["equal", "wide-start", "wide-end"], "equal") },
        h("div", { className: "kg-split__pane" }, p.start), h("div", { className: "kg-split__pane" }, p.end)));
  }

  // An agent can supply a picture, never an executable document or arbitrary
  // URL scheme. In particular SVG data URLs and javascript: are not images we
  // accept; relative paths cannot turn into protocol-relative external URLs.
  function imageSource(value) {
    if (typeof value !== "string" || /[\s\\<>]/.test(value)) return undefined;
    if (/^https:\/\/[^/]+\//i.test(value) || /^\/(?!\/)/.test(value) || /^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    return undefined;
  }

  function CoreImage(p) {
    var src = imageSource(p.src);
    return h("figure", { className: "kg-image kg-image--" + choice(p.ratio, ["auto", "square", "landscape", "portrait"], "auto") + " kg-image--" + choice(p.fit, ["cover", "contain"], "cover") },
      src ? h("img", { src: src, alt: p.alt || "", loading: "lazy", decoding: "async" }) : h("div", { className: "kg-missing", role: "alert" }, "Image source must be HTTPS, a local path or raster image data."),
      p.caption ? h("figcaption", null, p.caption) : null);
  }

  function CoreCode(p) {
    return h("figure", { className: "kg-code" },
      p.language || p.caption ? h("figcaption", null, p.caption || p.language) : null,
      h("pre", { className: p.wrap ? "kg-code__wrap" : undefined }, h("code", null, String(p.code == null ? "" : p.code))));
  }

  function CoreList(p) {
    var items = Array.isArray(p.items) ? p.items : [];
    return h(p.ordered ? "ol" : "ul", { className: "kg-list" }, items.map(function (item, i) { return h("li", { key: i }, String(item == null ? "" : item)); }));
  }
  function CoreDivider(p) { return h("hr", { className: "kg-divider" }); }

  function CoreTextarea(p) {
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("textarea", { className: "kg-input kg-textarea", rows: choice(p.rows, [3, 5, 8, 12], 5), value: p.value == null ? "" : p.value, placeholder: p.placeholder, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }),
      p.help ? h("span", { className: "kg-field__help" }, p.help) : null);
  }

  // Browser range controls need finite, ordered bounds. Expressions can change
  // them after validation, so clamp here as well as exposing numeric contracts.
  function rangeBounds(p) {
    var min = typeof p.min === "number" && isFinite(p.min) ? p.min : 0;
    var max = typeof p.max === "number" && isFinite(p.max) && p.max > min ? p.max : min + 100;
    var step = typeof p.step === "number" && isFinite(p.step) && p.step > 0 ? p.step : 1;
    var value = typeof p.value === "number" && isFinite(p.value) ? Math.max(min, Math.min(max, p.value)) : min;
    return { min: min, max: max, step: step, value: value };
  }
  function CoreSlider(p) {
    var bounds = rangeBounds(p);
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-slider__label" }, h("span", { className: "kg-field__label" }, p.label), h("output", null, bounds.value)),
      h("input", { className: "kg-slider", type: "range", "aria-label": p.label, min: bounds.min, max: bounds.max, step: bounds.step, value: bounds.value, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: Number(e.target.value) }); } }));
  }
  function CoreCheckbox(p) {
    return h("label", { className: "kg-checkbox" }, h("input", { type: "checkbox", checked: !!p.checked, disabled: p.disabled,
      onChange: function (e) { fire(p.onChange, { checked: e.target.checked }); } }), h("span", null, p.label));
  }

  function CoreBarChart(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.value === "number" && isFinite(it.value); });
    var max = items.reduce(function (m, it) { return Math.max(m, Math.abs(it.value)); }, 0) || 1;
    return h("figure", { className: "kg-bar-chart" }, h("figcaption", null, p.label),
      items.length ? h("ul", null, items.map(function (it, i) {
        return h("li", { key: i }, h("span", { className: "kg-bar-chart__label" }, it.label),
          h("span", { className: "kg-bar-chart__track", "aria-hidden": "true" }, h("span", { className: "kg-bar-chart__bar", style: { width: (Math.abs(it.value) / max * 100) + "%" } })),
          h("span", { className: "kg-bar-chart__value" }, fmt(it.value, p.format)));
      })) : h("p", null, p.empty || "No data to show"));
  }

  var SPACING = S("number", { enum: [0, 1, 2, 3, 4, 6, 8], default: 4 });
  var INSET = S("number", { enum: [0, 1, 2, 3, 4, 6, 8], default: 6 });
  var FLOW_INTERFACES = {
    page: { summary: "Sidebar-free page with optional header and footer and a reading, wide or full canvas.", props: { width: S("string", { enum: ["reading", "wide", "full"], default: "wide" }), inset: INSET, gap: SPACING }, slots: { header: {}, children: {}, footer: {} } },
    section: { summary: "Editorial or hero region with optional title, prose, content and actions.", props: { title: S("string"), eyebrow: S("string"), description: S("string"), level: S("number", { enum: [2, 3, 4], default: 2 }), tone: S("string", { enum: ["plain", "surface", "sunken", "accent"], default: "plain" }), inset: INSET, gap: SPACING }, slots: { children: {}, actions: {} } },
    grid: { summary: "Responsive equal-column grid that fits its container and stacks on narrow canvases.", props: { columns: S("number", { default: 3, description: "Maximum column count, a positive integer. Fewer columns render when needed to fit the canvas." }), minSize: S("string", { enum: ["small", "medium", "large"], default: "medium" }), gap: SPACING }, slots: { children: {} } },
    split: { summary: "Two flowing panes with a chosen ratio, stacked in source order on narrow canvases.", props: { ratio: S("string", { enum: ["equal", "wide-start", "wide-end"], default: "equal" }), gap: SPACING }, slots: { start: {}, end: {} } },
    image: { summary: "Accessible image with a semantic aspect ratio, fit and optional caption.", props: { src: S("string", { required: true }), alt: S("string", { required: true }), caption: S("string"), ratio: S("string", { enum: ["auto", "square", "landscape", "portrait"], default: "auto" }), fit: S("string", { enum: ["cover", "contain"], default: "cover" }) } },
    code: { summary: "Literal source code or structured text; displayed, never executed.", props: { code: S("string", { required: true }), language: S("string"), caption: S("string"), wrap: S("boolean", { default: false }) } },
    list: { summary: "Ordered or unordered prose list.", props: { items: S("array", { items: S("string"), required: true }), ordered: S("boolean", { default: false }) } },
    divider: { summary: "Semantic separator between flowing content regions.", props: {} },
    textarea: { summary: "Labelled multiline input with public value and change events.", props: { label: S("string", { required: true }), value: S("string"), placeholder: S("string"), help: S("string"), rows: S("number", { enum: [3, 5, 8, 12], default: 5 }), disabled: S("boolean") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    slider: { summary: "Labelled numeric range input with a live value.", props: { label: S("string", { required: true }), value: S("number"), min: S("number", { default: 0 }), max: S("number", { default: 100 }), step: S("number", { default: 1 }), disabled: S("boolean") }, local: { value: { type: "number", default: 50 } }, events: { change: { payload: { value: "number" } } }, outputs: ["value"] },
    checkbox: { summary: "Labelled boolean choice with public checked state.", props: { label: S("string", { required: true }), checked: S("boolean") , disabled: S("boolean") }, local: { checked: { type: "boolean", default: false } }, events: { change: { payload: { checked: "boolean" } } }, outputs: ["checked"] },
    "bar-chart": { summary: "Responsive horizontal bars with accessible labels and numeric values.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number") }, requiredKeys: ["label", "value"] }) }), format: S("string", { enum: ["text", "number", "currency", "percent"], default: "number" }), empty: S("string") } }
  };
  var FLOW_NOTES = {
    page: "Choose freely: reading for reports, wide for landing pages, full for tools. Any block may be the root. Navigation is optional.",
    section: "Compose heroes, report chapters and feature sections; actions are ordinary blocks. Avoid adding a card around every section.",
    grid: "Use for galleries, feature cards and dashboards; columns is the maximum, minSize controls when columns fit. Children remain in source order.",
    split: "Use for side-by-side explanation and interaction, image and prose, or input and output. Does not create a sidebar.",
    image: "Use HTTPS URLs, local / paths or raster data URLs. Provide descriptive alt text; use empty alt only for decoration.",
    code: "Display examples, JSON, logs or source. Content remains literal text even when it contains markup.",
    list: "Use for instructions, summaries and checklists; items are text, ordered enables numbered steps.",
    divider: "Separate adjacent topics without wrapping them in cards.",
    textarea: "Use for notes, drafts and longer answers. Read value or bind it to declared state; change emits {value}.",
    slider: "Use for numeric exploration and simulations; change emits {value}. Native arrow keys adjust by step.",
    checkbox: "Use for independent options; change emits {checked}. Space toggles the native checkbox.",
    "bar-chart": "Use for comparisons; bind items to data or $map. Values stay visible to assistive technology, including negative values."
  };
  var freeFlowExports = { CorePage: CorePage, CoreSection: CoreSection, CoreGrid: CoreGrid, CoreSplit: CoreSplit, CoreImage: CoreImage, CoreCode: CoreCode, CoreList: CoreList, CoreDivider: CoreDivider, CoreTextarea: CoreTextarea, CoreSlider: CoreSlider, CoreCheckbox: CoreCheckbox, CoreBarChart: CoreBarChart };
  Object.keys(FLOW_INTERFACES).forEach(function (name) {
    var I = FLOW_INTERFACES[name];
    I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "textarea" || name === "slider") DEFAULTS[name] = { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] };
    if (name === "checkbox") DEFAULTS[name] = { change: [{ do: "setLocal", key: "checked", value: { $event: "checked" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "line-control", "accent", "focus"], agent: { use: FLOW_NOTES[name] } });
    contracts[core[name]].a11y = { keyboard: name === "slider" ? "Native range: arrows and Home/End." : name === "checkbox" ? "Native checkbox: Tab and Space." : name === "textarea" ? "Native multiline text input: Tab to focus, typing to edit." : "Semantic content; interactive children own their keyboard behavior." };
  });

  // Catalog guidance can evolve without rewriting published contract refs.
  // Historical console-oriented notes otherwise keep steering new agents back
  // to sidebars even after the responsive roles have been installed.
  var authoring = {
    composition: "Any catalog block can be the root. Choose the shape from the content: page for reading/wide/full canvases, section for heroes or chapters, grid for collections, split for two panes, stack for local flow. Navigation is optional; tabs may be primary navigation and sidebars suit persistent workspace navigation.",
    guidance: {
      shell: { use: "Optional workspace frame with sidebar, header and main regions. Omit sidebar when it is not useful; page is another root choice.", avoid: "Nested workspace shells." },
      tabs: { use: "Switch between sibling views, including primary navigation when it fits the artifact." },
      stack: { use: "Local rows and columns. Use grid for responsive collections, split for unequal panes and page for a canvas.", avoid: "Undeclared styling; gap is a token spacing step." },
      text: { use: "Headings, short copy and long-form prose. Compose report chapters with sections; use $tpl for state-driven text." }
    }
  };
  var originalCatalog = catalog;
  catalog = function (systemId) {
    var text = originalCatalog(systemId);
    Object.keys(authoring.guidance).forEach(function (role) {
      var ref = systems[systemId].components[role];
      var c = contracts[ref];
      if (c.system !== "core") return; // structural system overrides keep their own guidance
      var old = "  use: " + c.agent.use + (c.agent.avoid ? " · avoid: " + c.agent.avoid : "");
      var notes = authoring.guidance[role];
      text = text.replace(old, "  use: " + notes.use + (notes.avoid ? " · avoid: " + notes.avoid : ""));
    });
    return (text.split("\n").slice(0, 2).join("\n") + "\n" + authoring.composition + "\n" + text.split("\n").slice(2).join("\n")).split("\n").map(function (line) { return line.trimEnd(); }).join("\n");
  };
  freeFlowExports.authoring = authoring;

/* Portable expressive blocks accept data, never markup or arbitrary SVG props.
 * Native controls own validation and keyboard behavior; shapes expose only a
 * fixed geometry vocabulary. See oracle/expressive-artifacts.feature. */
  function passiveLink(value) {
    if (typeof value !== "string" || /[\s\\<>]/.test(value)) return undefined;
    return /^(https?:\/\/[^/]+(?:\/|$)|\/(?!\/)|#|mailto:[^:]+@)/i.test(value) ? value : undefined;
  }
  function CoreLink(p) { var href = passiveLink(p.href); return href ? h("a", { className: "kg-link", href: href, target: p.newTab ? "_blank" : undefined, rel: p.newTab ? "noopener noreferrer" : undefined }, p.label) : h("span", null, p.label); }
  function richRuns(runs) {
    return (Array.isArray(runs) ? runs : []).map(function (run, i) {
      if (!run || typeof run.text !== "string") return null;
      var child = run.text;
      if (run.code) child = h("code", null, child);
      if (run.bold) child = h("strong", null, child);
      if (run.italic) child = h("em", null, child);
      var href = passiveLink(run.href);
      return h(href ? "a" : "span", { key: i, href: href }, child);
    });
  }
  function CoreRichText(p) {
    return h("div", { className: "kg-rich-text" }, (Array.isArray(p.nodes) ? p.nodes : []).map(function (node, i) {
      if (!node) return null;
      if (node.kind === "list") return h(node.ordered ? "ol" : "ul", { key: i }, (Array.isArray(node.items) ? node.items : []).map(function (item, j) { return h("li", { key: j }, String(item)); }));
      if (node.kind === "code") return h("pre", { key: i }, h("code", null, String(node.text || "")));
      var tag = node.kind === "heading" ? "h" + choice(node.level, [2, 3, 4], 2) : node.kind === "quote" ? "blockquote" : "p";
      return h(tag, { key: i }, node.runs ? richRuns(node.runs) : String(node.text || ""));
    }));
  }
  function CoreComposition(p) { return h("div", { className: "kg-composition" }, p.children); }
  function CoreTextField(p) {
    var uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: choice(p.kind, ["text", "email", "url"], "text"), "aria-label": p.label, "aria-describedby": p.help ? uid + "-help" : undefined, name: p.name, value: p.value == null ? "" : p.value, required: p.required, minLength: p.minLength, maxLength: p.maxLength, placeholder: p.placeholder, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }), p.help ? h("span", { id: uid + "-help", className: "kg-field__help" }, p.help) : null);
  }
  function CoreNumberInput(p) {
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: "number", name: p.name, value: typeof p.value === "number" && isFinite(p.value) ? p.value : "", min: p.min, max: p.max, step: typeof p.step === "number" && p.step > 0 ? p.step : "any", required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null }); } }));
  }
  function CoreDateInput(p) {
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: "date", name: p.name, value: p.value || "", min: p.min, max: p.max, required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }));
  }
  function CoreChoice(p) {
    var uid = R().useId();
    return h("fieldset", { className: "kg-choice", disabled: p.disabled }, h("legend", { className: "kg-field__label" }, p.label),
      (Array.isArray(p.options) ? p.options : []).map(function (o, i) { return h("label", { key: i }, h("input", { type: "radio", name: p.name || uid, value: o.value, checked: p.value === o.value, required: p.required, onChange: function () { fire(p.onChange, { value: o.value }); } }), h("span", null, o.label)); }));
  }
  function CoreMultiselect(p) {
    var selected = Array.isArray(p.value) ? p.value : [], uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("select", { className: "kg-input kg-multiselect", name: p.name, "aria-label": p.label, "aria-describedby": uid + "-help", multiple: true, value: selected, required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: Array.from(e.target.selectedOptions).map(function (o) { return o.value; }) }); } }, (Array.isArray(p.options) ? p.options : []).map(function (o, i) { return h("option", { key: i, value: o.value }, o.label); })),
      h("span", { id: uid + "-help", className: "kg-field__help" }, "Choose multiple with Ctrl or Command; use arrow keys and Shift on the keyboard."));
  }
  function CoreForm(p) {
    return h("form", { className: "kg-form", "aria-label": p.label, onSubmit: function (e) {
      e.preventDefault();
      var values = Object.create(null);
      new FormData(e.currentTarget).forEach(function (value, key) {
        if (["__proto__", "constructor", "prototype"].indexOf(key) >= 0) return;
        if (Object.prototype.hasOwnProperty.call(values, key)) values[key] = [].concat(values[key], String(value)); else values[key] = String(value);
      });
      fire(p.onSubmit, { values: values });
    } }, p.children, h("button", { className: "kg-btn kg-btn--primary", type: "submit", disabled: p.disabled }, p.submitLabel || "Submit"));
  }

  function finiteNumber(n, fallback) { return typeof n === "number" && isFinite(n) ? Math.max(-1000000, Math.min(1000000, n)) : fallback; }
  function paint(value, fallback) { return "var(--kg-" + choice(value, ["accent", "ink", "ink-muted", "line", "surface", "sunken", "paper", "success", "danger"], fallback) + ")"; }
  function CoreScene(p) {
    var width = Math.max(1, finiteNumber(p.width, 640)), height = Math.max(1, finiteNumber(p.height, 360));
    return h("figure", { className: "kg-scene" }, h("figcaption", null, p.label),
      h("svg", { viewBox: "0 0 " + width + " " + height, role: p.interactive ? "group" : "img", "aria-label": p.label }, h("title", null, p.label),
        (Array.isArray(p.shapes) ? p.shapes : []).slice(0, 2000).map(function (s, i) {
          if (!s || ["rect", "circle", "line", "path", "text"].indexOf(s.kind) < 0) return null;
          var attrs = { key: i, fill: s.kind === "line" || s.kind === "path" ? "none" : paint(s.fill, "surface"), stroke: paint(s.stroke, "ink"), strokeWidth: Math.max(0, finiteNumber(s.strokeWidth, 1)), "aria-label": s.label || undefined };
          if (p.interactive && typeof s.id === "string") {
            attrs.role = "button"; attrs.tabIndex = 0;
            attrs.onClick = function () { fire(p.onSelect, { id: s.id }); };
            attrs.onKeyDown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fire(p.onSelect, { id: s.id }); } };
          }
          if (s.kind === "rect") Object.assign(attrs, { x: finiteNumber(s.x, 0), y: finiteNumber(s.y, 0), width: Math.max(0, finiteNumber(s.width, 100)), height: Math.max(0, finiteNumber(s.height, 60)), rx: Math.max(0, finiteNumber(s.radius, 8)) });
          if (s.kind === "circle") Object.assign(attrs, { cx: finiteNumber(s.x, 0), cy: finiteNumber(s.y, 0), r: Math.max(0, finiteNumber(s.radius, 20)) });
          if (s.kind === "line") Object.assign(attrs, { x1: finiteNumber(s.x, 0), y1: finiteNumber(s.y, 0), x2: finiteNumber(s.x2, 100), y2: finiteNumber(s.y2, 100) });
          if (s.kind === "path") { if (typeof s.d !== "string" || s.d.length > 20000 || !/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/.test(s.d)) return null; attrs.d = s.d; }
          if (s.kind === "text") Object.assign(attrs, { x: finiteNumber(s.x, 0), y: finiteNumber(s.y, 0), fill: paint(s.fill, "ink"), stroke: "none", fontSize: Math.max(8, Math.min(64, finiteNumber(s.size, 16))) });
          return h(s.kind, attrs, s.kind === "text" ? String(s.text == null ? "" : s.text) : h("title", null, s.label || s.id || s.kind));
        })));
  }
  function CoreDiagram(p) {
    var nodes = (Array.isArray(p.nodes) ? p.nodes : []).filter(function (n) { return n && typeof n.id === "string"; }).slice(0, 200);
    var rows = Math.ceil(nodes.length / 3), width = 660, height = Math.max(140, rows * 140), positions = Object.create(null), shapes = [];
    nodes.forEach(function (n, i) { positions[n.id] = { x: finiteNumber(n.x, 20 + (i % 3) * 220), y: finiteNumber(n.y, 30 + Math.floor(i / 3) * 140) }; });
    (Array.isArray(p.edges) ? p.edges : []).forEach(function (edge) {
      var from = positions[edge.from], to = positions[edge.to]; if (!from || !to) return;
      shapes.push({ kind: "line", x: from.x + 90, y: from.y + 35, x2: to.x + 90, y2: to.y + 35, stroke: "ink-muted", strokeWidth: 2, label: edge.label || edge.from + " to " + edge.to });
    });
    nodes.forEach(function (n) {
      var pos = positions[n.id]; width = Math.max(width, pos.x + 200); height = Math.max(height, pos.y + 100);
      shapes.push({ kind: "rect", id: n.id, x: pos.x, y: pos.y, width: 180, height: 70, fill: n.tone || "surface", label: n.label });
      shapes.push({ kind: "text", x: pos.x + 12, y: pos.y + 42, text: String(n.label || n.id).slice(0, 20), label: n.label });
    });
    return CoreScene({ label: p.label, width: width, height: height, shapes: shapes, interactive: p.interactive, onSelect: p.onSelect });
  }
  function plot(p, scatter) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.x === "number" && isFinite(it.x) && typeof it.y === "number" && isFinite(it.y); }).slice(0, 2000);
    if (!items.length) return h("figure", { className: "kg-scene" }, h("figcaption", null, p.label), h("p", null, p.empty || "No data to show"));
    var xs = items.map(function (i) { return i.x; }), ys = items.map(function (i) { return i.y; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs), minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    // Normalize before subtraction so opposite near-MAX_VALUE coordinates do
    // not overflow into NaN geometry even though each input is finite.
    var scaleX = Math.max(Math.abs(minX), Math.abs(maxX), 1), scaleY = Math.max(Math.abs(minY), Math.abs(maxY), 1);
    var dx = maxX / scaleX - minX / scaleX, dy = maxY / scaleY - minY / scaleY;
    var points = items.map(function (it) { return { x: 50 + (dx ? (it.x / scaleX - minX / scaleX) / dx : .5) * 530, y: 250 - (dy ? (it.y / scaleY - minY / scaleY) / dy : .5) * 210 }; });
    var shapes = [{ kind: "line", x: 50, y: 250, x2: 580, y2: 250, stroke: "ink-muted" }, { kind: "line", x: 50, y: 40, x2: 50, y2: 250, stroke: "ink-muted" }];
    if (!scatter) shapes.push({ kind: "path", d: points.map(function (pt, i) { return (i ? "L" : "M") + pt.x + " " + pt.y; }).join(" "), stroke: "accent", strokeWidth: 3 });
    points.forEach(function (pt, i) { shapes.push({ kind: "circle", x: pt.x, y: pt.y, radius: 4, fill: "accent", label: (items[i].label || "Point " + (i + 1)) + ": " + items[i].x + ", " + items[i].y }); });
    shapes.push({ kind: "text", x: 50, y: 285, text: minX }, { kind: "text", x: 540, y: 285, text: maxX }, { kind: "text", x: 4, y: 36, text: maxY });
    return h("div", { className: "kg-plot" }, CoreScene({ label: p.label, width: 640, height: 310, shapes: shapes }),
      h("details", { className: "kg-chart-data" }, h("summary", null, "View chart data"), h("table", null, h("caption", null, p.label), h("thead", null, h("tr", null, h("th", null, "Label"), h("th", null, p.xLabel || "X"), h("th", null, p.yLabel || "Y"))), h("tbody", null, items.map(function (it, i) { return h("tr", { key: i }, h("td", null, it.label || i + 1), h("td", null, it.x), h("td", null, it.y)); })))));
  }
  function CoreLineChart(p) { return plot(p, false); }
  function CoreScatterChart(p) { return plot(p, true); }

  var CONTROL_PROPS = { label: S("string", { required: true }), name: S("string"), required: S("boolean"), disabled: S("boolean") };
  var OPTIONS_PROP = S("array", { required: true, items: S("object", { properties: { value: S("string"), label: S("string") }, requiredKeys: ["value", "label"] }) });
  var PLOT_PROPS = { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { x: S("number"), y: S("number"), label: S("string") }, requiredKeys: ["x", "y"] }) }), xLabel: S("string"), yLabel: S("string"), empty: S("string") };
  var EXPRESSIVE = {
    composition: { summary: "Reusable document-local composition with typed inputs and a public value output.", props: { name: S("string", { required: true }), inputs: S("object"), value: S("string|number|boolean|object|array|null") }, slots: { children: {} }, outputs: ["value"] },
    link: { summary: "Accessible passive link; executable URL schemes are refused.", props: { label: S("string", { required: true }), href: S("string", { required: true }), newTab: S("boolean") } },
    "rich-text": { summary: "Structured headings, paragraphs, quotes, lists and inline emphasis without raw HTML.", props: { nodes: S("array", { required: true, items: S("object", { requiredKeys: ["kind"] }) }) } },
    "text-field": { summary: "Named text, email or URL field with native form validation.", props: merge(CONTROL_PROPS, { value: S("string"), kind: S("string", { enum: ["text", "email", "url"], default: "text" }), help: S("string"), placeholder: S("string"), minLength: S("number"), maxLength: S("number") }), local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    "number-input": { summary: "Named numeric field with min/max/step validation; empty value is null.", props: merge(CONTROL_PROPS, { value: S("number|null"), min: S("number"), max: S("number"), step: S("number") }), local: { value: { type: "number|null", default: null } }, events: { change: { payload: { value: "number|null" } } }, outputs: ["value"] },
    "date-input": { summary: "Named date field with native picker and ISO date output.", props: merge(CONTROL_PROPS, { value: S("string"), min: S("string"), max: S("string") }), local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    choice: { summary: "Named radio group with native keyboard navigation and a public selection.", props: merge(CONTROL_PROPS, { value: S("string"), options: OPTIONS_PROP }), local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    multiselect: { summary: "Named multiple selection with native keyboard support and array output.", props: merge(CONTROL_PROPS, { value: S("array", { items: S("string") }), options: OPTIONS_PROP }), local: { value: { type: "array", default: [] } }, events: { change: { payload: { value: "array" } } }, outputs: ["value"] },
    form: { summary: "Native validated form; submit emits named field values as strings or arrays of strings.", props: { label: S("string", { required: true }), submitLabel: S("string", { default: "Submit" }), disabled: S("boolean") }, slots: { children: {} }, events: { submit: { payload: { values: "object" } } } },
    scene: { summary: "Responsive vector scene assembled from rect/circle/line/path/text geometry and token colors.", props: { label: S("string", { required: true }), width: S("number", { default: 640 }), height: S("number", { default: 360 }), shapes: S("array", { required: true, items: S("object", { requiredKeys: ["kind"] }) }), interactive: S("boolean") }, events: { select: { payload: { id: "string" } } } },
    diagram: { summary: "Node and edge diagram with automatic placement or explicit coordinates.", props: { label: S("string", { required: true }), nodes: S("array", { required: true, items: S("object", { requiredKeys: ["id", "label"] }) }), edges: S("array", { items: S("object", { requiredKeys: ["from", "to"] }) }), interactive: S("boolean") }, events: { select: { payload: { id: "string" } } } },
    "line-chart": { summary: "Responsive numeric X/Y line chart with an accessible data table.", props: PLOT_PROPS },
    "scatter-chart": { summary: "Responsive numeric X/Y scatter plot with an accessible data table.", props: PLOT_PROPS }
  };
  var EXPRESSIVE_NOTES = {
    composition: "Define doc.compositions[name] with typed inputs, root, blocks, optional output expression and outputType:{type,enum?}. Use $input inside the definition; read instance.value outside. Definitions expand to ordinary installed blocks; never contain HTML or executable code.",
    link: "Use HTTPS/HTTP, local / paths, #anchors or mailto links. Provide meaningful label text.",
    "rich-text": "nodes kinds: paragraph, heading (level 2/3/4), quote, list (items, ordered), code. Prose accepts text or runs [{text,bold?,italic?,code?,href?}]. Strings remain literal.",
    "text-field": "Use inside form with name and required/minLength/maxLength; email and url use browser validity. change emits {value}.",
    "number-input": "Use for calculations; an empty field emits null. Set name inside form; change emits {value}.",
    "date-input": "Date values and bounds are YYYY-MM-DD; change emits {value}.",
    choice: "Use for one option from a short list; options are [{value,label}]. change emits {value}.",
    multiselect: "Use for several choices; options are [{value,label}], value is a string array. change emits {value}.",
    form: "Place named native fields in children. Invalid fields prevent submit. submit emits {values}: string values, duplicate names become arrays. Wire submit to declared state or a host action.",
    scene: "shapes: {kind:rect|circle|line|path|text,id?,label?,x?,y?,width?,height?,radius?,x2?,y2?,d?,text?,size?,fill?,stroke?,strokeWidth?}. Colors: accent, ink, ink-muted, line, surface, sunken, paper, success, danger; no arbitrary SVG attributes. interactive shapes with id emit select {id} and support Enter/Space.",
    diagram: "nodes: [{id,label,x?,y?,tone?}], edges: [{from,to,label?}]. Coordinates are optional. interactive nodes emit select {id}.",
    "line-chart": "items: [{x,y,label?}]. Supply sorted x values for ordered paths. Data is available in a keyboard-accessible table.",
    "scatter-chart": "items: [{x,y,label?}]. Both axes are numeric; use for correlation and simulations."
  };
  Object.assign(freeFlowExports, { CoreComposition: CoreComposition, CoreLink: CoreLink, CoreRichText: CoreRichText, CoreTextField: CoreTextField, CoreNumberInput: CoreNumberInput, CoreDateInput: CoreDateInput, CoreChoice: CoreChoice, CoreMultiselect: CoreMultiselect, CoreForm: CoreForm, CoreScene: CoreScene, CoreDiagram: CoreDiagram, CoreLineChart: CoreLineChart, CoreScatterChart: CoreScatterChart });
  // The reference has a closed event-to-prop table. Without registering submit
  // before contracts are built, the renderer wires an undefined prop and a
  // perfectly valid form silently drops every successful submission.
  HANDLER.submit = "onSubmit";
  Object.keys(EXPRESSIVE).forEach(function (name) {
    var I = EXPRESSIVE[name]; I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (I.local) DEFAULTS[name] = { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "focus"], agent: { use: EXPRESSIVE_NOTES[name] } });
  });

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
  function dataTable(label, head, rows) {
    return h("details", { className: "kg-chart-data" }, h("summary", null, "View chart data"),
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
    return h("figure", { className: "kg-scene kg-area" }, h("figcaption", null, p.label),
      h("svg", { viewBox: "0 0 640 310", role: "img", "aria-label": p.label }, h("title", null, p.label),
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
      return h("path", { key: i, d: d, fill: seriesPaint(i), stroke: "var(--kg-paper)", strokeWidth: 2 }, h("title", null, it.label + ": " + it.value));
    });
    return h("figure", { className: "kg-scene kg-donut" }, h("figcaption", null, p.label),
      h("div", { className: "kg-donut__body" }, h("svg", { viewBox: "0 0 220 220", role: "img", "aria-label": p.label }, h("title", null, p.label), slices,
        hole ? h("text", { x: 110, y: 118, textAnchor: "middle", fill: "var(--kg-ink)", fontSize: 28 }, String(r2(total))) : null),
        h("ul", { className: "kg-legend" }, items.map(function (it, i) { return h("li", { key: i }, h("span", { className: "kg-legend__swatch", style: { background: seriesPaint(i) } }), it.label, h("span", { className: "kg-legend__value" }, Math.round(it.value / total * 100) + "%")); }))),
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
            return h("td", { key: j, style: ok ? { background: "color-mix(in srgb, var(--kg-accent) " + Math.round(12 + (span ? (v / sc - lo / sc) / span : .5) * 78) + "%, var(--kg-paper))" } : undefined, title: r + " / " + c + ": " + (ok ? v : "no data") }, ok ? v : "–");
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
    "donut-chart": { summary: "Part-to-whole ring chart with a legend, percentages and an accessible data table.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number") }, requiredKeys: ["label", "value"] }) }), hole: S("boolean", { default: true }), empty: S("string") } },
    gauge: { summary: "Single value on a half-ring scale between a minimum and maximum.", props: { label: S("string", { required: true }), value: S("number", { required: true }), min: S("number", { default: 0 }), max: S("number", { default: 100 }), unit: S("string"), tone: TONE4 } },
    sparkline: { summary: "Tiny inline trend line for a series of numbers; sits next to a stat or in a table cell.", props: { label: S("string", { required: true }), values: S("array", { required: true, items: S("number") }), tone: TONE4 } },
    heatmap: { summary: "Row by column matrix whose cell shading shows magnitude, with every value readable as text.", props: { label: S("string", { required: true }), rows: S("array", { required: true, items: S("string") }), columns: S("array", { required: true, items: S("string") }), values: S("array", { required: true, items: S("array", { items: S("number") }) }), empty: S("string") } },
    alert: { summary: "Inline callout for information, success, warning or danger with an optional title and content.", props: { tone: S("string", { enum: ["info", "success", "warning", "danger"], default: "info" }), title: S("string"), text: S("string") }, slots: { children: {} } },
    accordion: { summary: "Stack of headings that each reveal a panel; one open at a time with a public value.", props: { items: S("array", { required: true, items: S("object", { properties: { id: S("string"), title: S("string"), body: S("string") }, requiredKeys: ["id", "title"] }) }), value: S("string") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    stepper: { summary: "Ordered progress through named steps; optionally clickable, with the current step public.", props: { label: S("string", { required: true }), steps: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string"), description: S("string") }, requiredKeys: ["id", "label"] }) }), value: S("string"), interactive: S("boolean") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    timeline: { summary: "Chronological list of events with optional times, descriptions and tone.", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { title: S("string"), time: S("string"), description: S("string"), tone: S("string", { enum: ["neutral", "accent", "success", "danger"] }) }, requiredKeys: ["title"] }) }) } },
    modal: { summary: "Dialog layered over the artifact; opened and closed by commands, Escape or the close button.", props: { label: S("string", { required: true }), open: S("boolean"), closeLabel: S("string") }, slots: { children: {} }, local: { open: { type: "boolean", default: false } }, events: { change: { payload: { open: "boolean" } } }, outputs: ["open"] }
  };
  var RICH_NOTES = {
    "area-chart": "items: [{x,y,label?}] with sorted x. Use for volume over time; prefer line-chart when several readings overlap.",
    "donut-chart": "items: [{label,value}] with positive values, at most 12 slices. Use for part-to-whole with few categories; use bar-chart to compare many.",
    gauge: "value within min..max (clamped). tone is a token colour. Use for one KPI against a known scale, not for trends.",
    sparkline: "values: number[]; no axes. Put beside a stat for trend. Provide a label that states what the series is.",
    heatmap: "rows and columns are labels; values[row][column] numbers. Use for intensity across two categories. Missing cells show a dash.",
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
    if (name === "modal") DEFAULTS[name] = { change: [{ do: "setLocal", key: "open", value: { $event: "open" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "wire", "success", "danger", "focus"], agent: { use: RICH_NOTES[name] } });
  });

  var ledger = {
    sidebar: contract("ledger", "sidebar", "2.0.0", "kages/nav@1", LedgerSidebar, { tokens: ["ledger-sunken", "ledger-line", "ledger-accent"], agent: { use: "Grouped nav: set `group` on items for section headers, `code` for 2–4 char tickers.", avoid: "Long labels; Ledger truncates at one line." } }),
    dropdown: contract("ledger", "dropdown", "2.0.0", "kages/select@1", LedgerDropdown, { limits: { maxOptions: 6 }, tokens: ["ledger-line-control", "ledger-accent", "ledger-accent-ink"], agent: { use: "Segmented control: every option visible, one tap. Up to 6 short options.", avoid: "Long or dynamic option lists — pin `core/dropdown@1` for those." } }),
    tabs: contract("ledger", "tabs", "2.0.0", "kages/tabs@1", LedgerTabs, { tokens: ["ledger-line", "ledger-ink", "ledger-wire"], agent: { use: "Mono uppercase tabs; `count` renders as [n].", avoid: "Tab labels over 14 characters." } }),
    button: contract("ledger", "button", "2.1.0", "kages/button@1", LedgerButton, { props: { kbd: S("string") }, tokens: ["ledger-accent", "ledger-line-control"], agent: { use: "`kbd` shows a keyboard hint (display only).", avoid: "Sentence-case labels; Ledger uppercases." } }),
    card: contract("ledger", "card", "2.0.0", "kages/card@1", LedgerCard, { props: { code: S("string") }, tokens: ["ledger-surface", "ledger-line", "ledger-sunken"], agent: { use: "Panels in dense grids; `code` is a short panel id like PNL-01.", avoid: "Padding-heavy content; bodies sit flush." } }),
    stat: contract("ledger", "stat", "2.0.0", "kages/stat@1", LedgerStat, { props: { trend: S("array", { items: S("number") }) }, tokens: ["ledger-ink", "ledger-wire"], agent: { use: "`trend` (8–30 numbers) draws a sparkline.", avoid: "Decorative trends with no data." } })
  };
  var atelier = {
    sidebar: contract("atelier", "sidebar", "1.0.0", "kages/nav@1", AtelierSidebar, { tokens: ["atelier-surface", "atelier-accent-soft", "atelier-radius-lg"], agent: { use: "Up to 6 items, each may carry a one-line `description`.", avoid: "Dense tool navigation — that is Ledger's job." } }),
    dropdown: contract("atelier", "dropdown", "1.0.0", "kages/select@1", AtelierDropdown, { limits: { maxOptions: 10 }, tokens: ["atelier-line-control", "atelier-accent", "atelier-accent-soft"], agent: { use: "Chips that wrap; good for 2–10 friendly choices.", avoid: "Options over 3 words." } }),
    tabs: contract("atelier", "tabs", "1.0.0", "kages/tabs@1", AtelierTabs, { tokens: ["atelier-sunken", "atelier-surface", "atelier-radius-pill"], agent: { use: "Pill switcher for 2–4 views.", avoid: "More than 4 tabs." } }),
    button: contract("atelier", "button", "1.0.0", "kages/button@1", AtelierButton, { tokens: ["atelier-ink", "atelier-accent-soft", "atelier-radius-pill"], agent: { use: "Pill buttons; primary is ink-filled.", avoid: "More than one primary per card." } }),
    card: contract("atelier", "card", "1.0.0", "kages/card@1", AtelierCard, { props: { eyebrow: S("string"), tone: S("string", { enum: ["default", "tinted"] }) }, tokens: ["atelier-surface", "atelier-sunken", "atelier-radius-lg", "atelier-shadow-soft"], agent: { use: "`eyebrow` is a short kicker above a serif title; actions sit at the bottom.", avoid: "Tables inside Atelier cards on narrow screens." } }),
    stat: contract("atelier", "stat", "1.0.0", "kages/stat@1", AtelierStat, { tokens: ["atelier-ink", "atelier-wire"], agent: { use: "Big serif figure with a sentence `caption`.", avoid: "More than 3 per row." } })
  };
  function extend(base, own) { var o = {}, k; for (k in base) o[k] = base[k]; for (k in own) o[k] = own[k]; return o; }
  var systems = {
    core: { id: "core", name: "Kages Core", version: "1.7.0", className: "kg-sys-core", extends: null, summary: "Neutral lattice system. The base every other system extends.", components: core },
    ledger: { id: "ledger", name: "Ledger", version: "2.4.0", className: "kg-sys-ledger", extends: "core@1", summary: "Dense, square, mono-numeral system for data and operations tools.", components: extend(core, ledger) },
    atelier: { id: "atelier", name: "Atelier", version: "1.3.0", className: "kg-sys-atelier", extends: "core@1", summary: "Soft, editorial, serif system for consumer and storytelling artifacts.", components: extend(core, atelier) }
  };

  /* resolve a block `type` against a system:
     "dropdown"                 -> the system's dropdown
     "dropdown@1"               -> the system's dropdown if its major is 1
     "core/dropdown@1.3.0" / "core/dropdown@1" -> that exact implementation (cross-system pin) */
  function semverMatch(have, want) { if (!want) return true; var a = have.split("."), b = String(want).split("."); for (var i = 0; i < b.length; i++) if (a[i] !== b[i]) return false; return true; }
  function resolve(systemId, type) {
    var sys = systems[systemId]; if (!sys) return { error: "Unknown design system '" + systemId + "'" };
    var m = /^(?:([a-z][a-z0-9-]*)\/)?([a-z][a-z0-9-]*)(?:@([0-9.]+))?$/.exec(type || "");
    if (!m) return { error: "Malformed type '" + type + "'" };
    var ref;
    if (m[1]) { var src = systems[m[1]]; if (!src) return { error: "Unknown design system '" + m[1] + "' in '" + type + "'" }; ref = src.components[m[2]]; if (ref && ref.indexOf(m[1] + "/") !== 0) { /* inherited: fine */ } }
    else ref = sys.components[m[2]];
    if (!ref) return { error: "'" + m[2] + "' is not a component of " + (m[1] || systemId) };
    if (m[1] && ref.split("@")[0] !== m[1] + "/" + m[2]) { var direct = Object.keys(contracts).filter(function (k) { return k.indexOf(m[1] + "/" + m[2] + "@") === 0; })[0]; if (direct) ref = direct; }
    var c = contracts[ref];
    if (!semverMatch(c.version, m[3])) return { error: type + " requested but " + c.ref + " is installed" };
    return { ref: ref, contract: c, impl: impls[ref] };
  }

  /* ============================== EXPRESSIONS ============================== */
  function getPath(obj, path) { if (path == null || path === "") return obj; var ps = String(path).split("."); for (var i = 0; i < ps.length; i++) { if (obj == null || typeof obj !== "object" || !Object.prototype.hasOwnProperty.call(obj, ps[i])) return undefined; obj = obj[ps[i]]; } return obj; }
  function setPath(obj, path, val) { var ps = String(path).split("."), o = obj; if (ps.some(function (k) { return k === "__proto__" || k === "constructor" || k === "prototype"; })) return; for (var i = 0; i < ps.length - 1; i++) { if (o[ps[i]] == null || typeof o[ps[i]] !== "object") o[ps[i]] = {}; o = o[ps[i]]; } o[ps[ps.length - 1]] = val; }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  var OPS = ["$state", "$block", "$self", "$event", "$data", "$item", "$not", "$eq", "$neq", "$and", "$or", "$if", "$tpl", "$filter", "$count", "$sum", "$find", "$map"];
  function isExpr(x) { if (!x || typeof x !== "object" || Array.isArray(x)) return false; var ks = Object.keys(x); return ks.length >= 1 && OPS.indexOf(ks[0]) >= 0; }

  function evaluate(x, ctx) {
    if (Array.isArray(x)) return x.map(function (v) { return evaluate(v, ctx); });
    if (!x || typeof x !== "object") return x;
    if (!isExpr(x)) { var o = {}; for (var k in x) o[k] = evaluate(x[k], ctx); return o; }
    var op = Object.keys(x)[0], a = x[op];
    switch (op) {
      case "$state": return getPath(ctx.state, a);
      case "$block": { var dot = a.indexOf("."), id = dot < 0 ? a : a.slice(0, dot), key = dot < 0 ? "" : a.slice(dot + 1); return getPath(ctx.output(id), key); }
      case "$self": return getPath(ctx.self ? ctx.output(ctx.self) : undefined, a);
      case "$event": return getPath(ctx.event, a);
      case "$data": return getPath(ctx.data, a);
      case "$item": return getPath(ctx.item, a);
      case "$not": return !evaluate(a, ctx);
      case "$eq": return evaluate(a[0], ctx) === evaluate(a[1], ctx);
      case "$neq": return evaluate(a[0], ctx) !== evaluate(a[1], ctx);
      case "$and": return a.every(function (v) { return !!evaluate(v, ctx); });
      case "$or": return a.some(function (v) { return !!evaluate(v, ctx); });
      case "$if": return evaluate(a[0], ctx) ? evaluate(a[1], ctx) : evaluate(a[2], ctx);
      case "$tpl": return String(a).replace(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g, function (_, ns, p) { var e = {}; e["$" + ns] = p; var v = evaluate(e, ctx); return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v); });
      case "$filter": {
        var list = evaluate(a.list, ctx) || [], eq = evaluate(a.equals, ctx), skip = a.skipIf !== undefined ? evaluate(a.skipIf, ctx) : undefined;
        var q = a.contains !== undefined ? String(evaluate(a.contains, ctx) || "").toLowerCase() : null;
        return list.filter(function (r) {
          if (a.equals !== undefined && !(skip !== undefined && eq === skip) && eq != null && getPath(r, a.field) !== eq) return false;
          if (q) { var hay = (a.fields || [a.field]).map(function (f) { return String(getPath(r, f) || ""); }).join(" ").toLowerCase(); if (hay.indexOf(q) < 0) return false; }
          return true;
        });
      }
      case "$count": { var l = evaluate(a, ctx); return Array.isArray(l) ? l.length : 0; }
      case "$sum": { var l2 = evaluate(a[0], ctx) || []; return l2.reduce(function (s, r) { return s + (Number(getPath(r, a[1])) || 0); }, 0); }
      case "$find": { var l3 = evaluate(a.list, ctx) || [], v3 = evaluate(a.equals, ctx); for (var i = 0; i < l3.length; i++) if (getPath(l3[i], a.field) === v3) return l3[i]; return null; }
      case "$map": { var l4 = evaluate(a.list, ctx) || []; return l4.map(function (it) { return evaluate(a.to, merge(ctx, { item: it })); }); }
    }
    return undefined;
  }
  function walkExpr(x, fn) { if (Array.isArray(x)) return x.forEach(function (v) { walkExpr(v, fn); }); if (!x || typeof x !== "object") return; if (isExpr(x)) fn(Object.keys(x)[0], x[Object.keys(x)[0]]); if (Object.keys(x)[0] === '$literal') return; for (var k in x) walkExpr(x[k], fn); }

  /* ============================== RUNTIME ============================== */
  function systemOf(doc, override) { if (override) return override; var s = String(doc.system || "core@1"); return s.split("@")[0]; }
  function initLocals(doc, sysId) {
    var L = {};
    Object.keys(doc.blocks || {}).forEach(function (id) {
      var b = doc.blocks[id], r = resolve(sysId, b.type); if (!r.contract) return;
      var loc = {}; for (var k in r.contract.local) loc[k] = r.contract.local[k].default;
      if (b.props) for (var k2 in r.contract.local) if (b.props[k2] !== undefined && !isExpr(b.props[k2])) loc[k2] = b.props[k2];
      L[id] = loc;
    });
    return L;
  }

  function makeCtx(doc, sysId, state, locals) {
    var cache = {}, busy = {};
    var ctx = { state: state, data: doc.data || {}, locals: locals };
    ctx.output = function (id) {
      if (cache[id]) return cache[id];
      if (busy[id]) throw new Error("Reference cycle through block '" + id + "'");
      var b = (doc.blocks || {})[id]; if (!b) return undefined;
      var r = resolve(sysId, b.type); if (!r.contract) return undefined;
      busy[id] = true;
      var out = {}, c = r.contract, sub = merge(ctx, { self: id });
      for (var k in c.props) if (c.props[k].default !== undefined) out[k] = c.props[k].default;
      for (var k1 in c.local) out[k1] = locals[id] ? locals[id][k1] : c.local[k1].default;
      var own = b.props ? merge(b.props, (b.props.x && b.props.x[sysId]) || {}) : null;
      if (own) for (var k2 in own) { if (k2 === "x" || (c.local[k2] && !isExpr(own[k2]))) continue; out[k2] = evaluate(own[k2], sub); }
      if (b.bind) for (var k3 in b.bind) out[k3] = evaluate(b.bind[k3], sub);
      var outputType = b.type === 'composition' && doc.compositions && doc.compositions[b.props.name] && doc.compositions[b.props.name].outputType; if (outputType && !matchesInput(outputType, out.value)) throw new Error('Invalid composition output at ' + id);
      busy[id] = false; cache[id] = out; return out;
    };
    return ctx;
  }

  /* run a list of actions against drafts; returns nothing, mutates drafts */
  function runActions(doc, sysId, actions, draft, self, event, log, depth) {
    if (!actions) return; if ((depth || 0) > 8) { log.push({ level: "error", msg: "Action depth > 8 (loop?)" }); return; }
    (Array.isArray(actions) ? actions : [actions]).forEach(function (a) {
      var ctx = merge(makeCtx(doc, sysId, draft.state, draft.locals), { self: self, event: event });
      if (a.when !== undefined && !evaluate(a.when, ctx)) return;
      switch (a.do) {
        case "set": setPath(draft.state, a.path, evaluate(a.value, ctx)); break;
        case "toggle": setPath(draft.state, a.path, !getPath(draft.state, a.path)); break;
        case "setLocal": { var tgt = a.target && a.target !== "$self" ? a.target : self; draft.locals[tgt] = draft.locals[tgt] || {}; draft.locals[tgt][a.key] = evaluate(a.value, ctx); break; }
        case "call": {
          var tid = a.target === "$self" ? self : a.target, tb = doc.blocks[tid]; if (!tb) { log.push({ level: "error", msg: "call: no block '" + tid + "'" }); break; }
          var tr = resolve(sysId, tb.type), cmd = tr.contract && tr.contract.commands[a.command];
          if (!cmd) { log.push({ level: "error", msg: "call: " + tid + " has no command '" + a.command + "'" }); break; }
          runActions(doc, sysId, cmd, draft, tid, evaluate(a.args || {}, ctx), log, (depth || 0) + 1); break;
        }
        case "log": log.push({ level: "info", msg: String(evaluate(a.message, ctx)) }); break;
        case "ask": case "agent": case "fetch": case "emit":
          log.push({ level: "info", msg: a.do + " → host (" + JSON.stringify(evaluate(a.args || {}, ctx)) + ")" });
          if (a.into) setPath(draft.state, a.into, evaluate(a.mock !== undefined ? a.mock : null, ctx)); break;
        default: log.push({ level: "error", msg: "Unknown action '" + a.do + "'" });
      }
    });
  }

  var ACTIONS = ["set", "toggle", "setLocal", "call", "log", "ask", "agent", "fetch", "emit"];

  function Missing(p) { return h("div", { className: "kg-missing", role: "alert" }, h("strong", null, p.id), " — ", p.msg); }

  function KageRenderer(p) {
    var r = R(), doc = p.doc || { blocks: {} }, sysId = systemOf(doc, p.system);
    var s1 = r.useState(function () { return clone(doc.state || {}); }), state = s1[0], setState = s1[1];
    var s2 = r.useState(function () { return initLocals(doc, sysId); }), locals = s2[0], setLocals = s2[1];
    var logRef = r.useRef([]);
    var sys = systems[sysId];
    if (!sys) return h(Missing, { id: "system", msg: "Unknown design system '" + sysId + "'" });
    try { doc = expandDocument(doc, makeCtx(doc, sysId, state, locals), evaluate, getPath, function (d) { return makeCtx(d, sysId, state, merge(initLocals(d, sysId), locals)); }); } catch (e) { return h(Missing, { id: 'collection', msg: e.message }); }
    locals = merge(initLocals(doc, sysId), locals);
    var ctx = makeCtx(doc, sysId, state, locals);

    function dispatch(id, evName, payload) {
      var b = doc.blocks[id], rr = resolve(sysId, b.type), draft = { state: clone(state), locals: clone(locals) }, log = [];
      runActions(doc, sysId, rr.contract.defaults[evName], draft, id, payload, log);
      runActions(doc, sysId, (b.on || {})[evName], draft, id, payload, log);
      logRef.current = log.concat(logRef.current).slice(0, 20);
      setState(draft.state); setLocals(draft.locals);
      if (p.onLog && log.length) p.onLog(log);
      if (p.onState) p.onState(draft.state);
    }

    function renderBlock(id, seen) {
      seen = seen || {};
      if (seen[id]) return h(Missing, { key: id, id: id, msg: "slot cycle" });
      var b = doc.blocks[id]; if (!b) return h(Missing, { key: id, id: id, msg: "no such block" });
      var rr = resolve(sysId, b.type); if (rr.error) return h(Missing, { key: id, id: id, msg: rr.error });
      var c = rr.contract, sub = merge(ctx, { self: id });
      if (b.visible !== undefined && !evaluate(b.visible, sub)) return null;
      var props;
      try { props = merge({}, ctx.output(id)); } catch (e) { return h(Missing, { key: id, id: id, msg: e.message }); }
      var nseen = merge(seen, {}); nseen[id] = true;
      Object.keys(c.slots).forEach(function (sl) {
        var kids = ((b.slots || {})[sl] || []).map(function (cid) { return renderBlock(cid, nseen); });
        if (sl === "children") props.children = kids; else props[sl] = kids;
      });
      Object.keys(c.events).forEach(function (ev) { props[c.events[ev].handler] = function (payload) { dispatch(id, ev, payload); }; });
      props.key = id;
      return h("div", { key: id, className: "kg-block", "data-block": id, "data-type": rr.ref, style: { display: "contents" } }, h(rr.impl, props));
    }
    return h("div", { className: cx("kg-kage", sys.className, p.className), "data-system": sys.id + "@" + sys.version }, renderBlock(doc.root));
  }

  /* ============================== VALIDATOR ============================== */
  function typeOk(spec, v) {
    if (v === undefined || v === null || !spec || !spec.type) return true;
    return spec.type.split("|").some(function (t) { return t === "array" ? Array.isArray(v) : t === "object" ? typeof v === "object" && !Array.isArray(v) : typeof v === t; });
  }
  function validate(doc, override) {
    var errors = [], warnings = [], sysId = systemOf(doc, override), blocks = doc.blocks || {};
    function E(at, code, msg) { errors.push({ at: at, code: code, msg: msg }); }
    function Wn(at, code, msg) { warnings.push({ at: at, code: code, msg: msg }); }
    if (!doc.kages) Wn("/", "no-version", "Missing `kages` document version");
    if (!systems[sysId]) { E("/system", "unknown-system", "Unknown design system " + sysId); return { ok: false, errors: errors, warnings: warnings, system: sysId }; }
    if (!blocks[doc.root]) E("/root", "missing-root", "root '" + doc.root + "' is not a block");
    var parent = {}, resolved = {};
    Object.keys(blocks).forEach(function (id) {
      var b = blocks[id], at = "/blocks/" + id;
      if (!/^[a-z][a-zA-Z0-9_-]{0,47}$/.test(id)) E(at, "bad-id", "Block ids are lowerCamel/kebab, start with a letter");
      var r = resolve(sysId, b.type); if (r.error) { E(at + "/type", "unresolved-type", r.error); return; }
      resolved[id] = r; var c = r.contract;
      Object.keys(c.props).forEach(function (k) {
        var spec = c.props[k], given = (b.props || {})[k] !== undefined || (b.bind || {})[k] !== undefined;
        if (spec.required && !given) E(at + "/props/" + k, "missing-prop", c.ref + " requires `" + k + "`");
        var v = (b.props || {})[k];
        if (v !== undefined && !isExpr(v)) {
          if (!typeOk(spec, v)) E(at + "/props/" + k, "type", "`" + k + "` should be " + spec.type);
          if (spec.enum && spec.enum.indexOf(v) < 0) E(at + "/props/" + k, "enum", "`" + k + "` must be one of " + spec.enum.join(", "));
          if (spec.items && spec.items.requiredKeys && Array.isArray(v)) v.forEach(function (it, i) { spec.items.requiredKeys.forEach(function (rk) { if (!it || it[rk] === undefined) E(at + "/props/" + k + "/" + i, "missing-key", "item needs `" + rk + "`"); }); });
        }
      });
      var xp = ((b.props || {}).x || {});
      Object.keys(xp).forEach(function (xs) { if (!systems[xs]) Wn(at + "/props/x/" + xs, "unknown-system", "extension props for unknown system '" + xs + "'"); });
      Object.keys(xp[sysId] || {}).forEach(function (k) { if (!c.props[k]) Wn(at + "/props/x/" + sysId + "/" + k, "unknown-prop", c.ref + " has no prop `" + k + "`"); else if (!isExpr(xp[sysId][k]) && !typeOk(c.props[k], xp[sysId][k])) E(at + "/props/x/" + sysId + "/" + k, "type", "`" + k + "` should be " + c.props[k].type); });
      Object.keys(b.props || {}).filter(function (k) { return k !== "x"; }).concat(Object.keys(b.bind || {})).forEach(function (k) { if (!c.props[k] && !c.local[k]) Wn(at + "/props/" + k, "unknown-prop", c.ref + " has no prop `" + k + "` (it will be ignored)"); });
      if (c.limits.maxOptions && Array.isArray((b.props || {}).options) && b.props.options.length > c.limits.maxOptions) Wn(at, "limit", c.ref + " shows at most " + c.limits.maxOptions + " options; pin core/dropdown@1 or trim");
      Object.keys(b.slots || {}).forEach(function (sl) {
        if (!c.slots[sl]) E(at + "/slots/" + sl, "unknown-slot", c.ref + " has no slot `" + sl + "`");
        else if (c.slots[sl].max && b.slots[sl].length > c.slots[sl].max) E(at + "/slots/" + sl, "slot-max", "`" + sl + "` takes at most " + c.slots[sl].max);
        (b.slots[sl] || []).forEach(function (cid) {
          if (!blocks[cid]) E(at + "/slots/" + sl, "missing-child", "no block '" + cid + "'");
          else if (parent[cid]) E(at + "/slots/" + sl, "two-parents", "'" + cid + "' is already placed in '" + parent[cid] + "'");
          else parent[cid] = id;
        });
      });
      Object.keys(c.slots).forEach(function (sl) { if (c.slots[sl].required && !((b.slots || {})[sl] || []).length) E(at + "/slots/" + sl, "empty-slot", "`" + sl + "` needs at least one block"); });
      Object.keys(b.on || {}).forEach(function (ev) { if (!c.events[ev]) E(at + "/on/" + ev, "unknown-event", c.ref + " emits no `" + ev + "` (emits: " + (Object.keys(c.events).join(", ") || "nothing") + ")"); });
    });
    // refs + actions (after all types resolved)
    Object.keys(blocks).forEach(function (id) {
      var b = blocks[id], at = "/blocks/" + id;
      walkExpr([b.props, b.bind, b.visible, b.on, b.repeat && b.repeat.each], function (op, arg) {
        if (op === "$block") {
          var tid = String(arg).split(".")[0], key = String(arg).split(".")[1];
          if (!blocks[tid]) E(at, "dangling-ref", "$block '" + arg + "': no block '" + tid + "'");
          else if (resolved[tid] && key && resolved[tid].contract.outputs.indexOf(key) < 0) E(at, "private-output", "$block '" + arg + "': " + resolved[tid].contract.ref + " outputs only " + (resolved[tid].contract.outputs.join(", ") || "nothing"));
        }
        if (op === "$state" && doc.state && getPath(doc.state, String(arg).split(".")[0]) === undefined) Wn(at, "undeclared-state", "$state '" + arg + "' is not declared in `state`");
        if (op === "$data" && getPath(doc.data || {}, String(arg).split(".")[0]) === undefined) E(at, "missing-data", "$data '" + arg + "' is not in `data`");
      });
      Object.keys(b.on || {}).forEach(function (ev) {
        (b.on[ev] || []).forEach(function (a, i) {
          var aat = at + "/on/" + ev + "/" + i;
          if (ACTIONS.indexOf(a.do) < 0) E(aat, "unknown-action", "Unknown action `" + a.do + "`");
          if ((a.do === "set" || a.do === "toggle") && doc.state && getPath(doc.state, String(a.path).split(".")[0]) === undefined) Wn(aat, "undeclared-state", "writes undeclared state '" + a.path + "'");
          if (a.do === "ask" && (!a.prompt || !a.into)) E(aat, "missing-field", "`ask` needs `prompt` and `into`");
          if (a.do === "agent" && (!a.agent || !a.into)) E(aat, "missing-field", "`agent` needs `agent` (a registered agent id) and `into`");
          if (a.do === "fetch" && a.source && !(doc.sources || {})[a.source]) E(aat, "missing-source", "`fetch` names source '" + a.source + "', which is not in `sources`");
          if (a.do === "setLocal") E(aat, "foreign-local", "Blocks change another block's local state only through its commands (`call`)");
          if (a.do === "call") { var t = a.target === "$self" ? id : a.target; if (!blocks[t]) E(aat, "dangling-ref", "call target '" + t + "' does not exist"); else if (resolved[t] && !resolved[t].contract.commands[a.command]) E(aat, "unknown-command", resolved[t].contract.ref + " has no command `" + a.command + "` (has: " + (Object.keys(resolved[t].contract.commands).join(", ") || "none") + ")"); }
        });
      });
    });
    // cycles through $block refs
    var color = {};
    function dfs(id, path) {
      if (color[id] === 1) { E("/blocks/" + id, "ref-cycle", "reference cycle: " + path.concat(id).join(" → ")); return; }
      if (color[id] === 2 || !blocks[id]) return; color[id] = 1;
      walkExpr([blocks[id].props, blocks[id].bind], function (op, arg) { if (op === "$block") dfs(String(arg).split(".")[0], path.concat(id)); });
      color[id] = 2;
    }
    Object.keys(blocks).forEach(function (id) { dfs(id, []); });
    Object.keys(blocks).forEach(function (id) { if (id !== doc.root && !parent[id]) Wn("/blocks/" + id, "orphan", "'" + id + "' is never placed in a slot"); });
    // portability: props outside the interface
    var portable = true;
    Object.keys(resolved).forEach(function (id) { var c = resolved[id].contract, I = interfaces[c.implements[0]]; Object.keys(blocks[id].props || {}).forEach(function (k) { if (k !== "x" && !I.props[k] && !(I.local || {})[k]) portable = false; }); if (/\//.test(blocks[id].type)) portable = false; });
    return { ok: errors.length === 0, errors: errors, warnings: warnings, system: sysId, portable: portable };
  }

  /* agent catalog: compact text an agent skill can embed */
  function catalog(systemId) {
    var sys = systems[systemId], out = ["# " + sys.name + " " + sys.version + " (" + sys.id + ")" + (sys.extends ? " extends " + sys.extends : ""), sys.summary, ""];
    Object.keys(sys.components).forEach(function (name) {
      var c = contracts[sys.components[name]];
      var props = Object.keys(c.props).map(function (k) { var s = c.props[k]; return k + (s.required ? "*" : "") + ":" + (s.enum ? s.enum.join("|") : s.type); }).join(", ");
      out.push("- " + name + " → " + c.ref + " [" + c.implements[0] + "] " + c.summary);
      out.push("  props: " + props + (Object.keys(c.slots).length ? " · slots: " + Object.keys(c.slots).join(", ") : "") + (Object.keys(c.events).length ? " · events: " + Object.keys(c.events).join(", ") : "") + (c.outputs.length ? " · outputs: " + c.outputs.join(", ") : "") + (Object.keys(c.commands).length ? " · commands: " + Object.keys(c.commands).join(", ") : ""));
      if (c.agent.use) out.push("  use: " + c.agent.use + (c.agent.avoid ? " · avoid: " + c.agent.avoid : ""));
    });
    return out.join("\n");
  }


  /* ============================== AGENT INTERFACES ============================== */
  /* describe(): a text view of a Kage for agents that cannot see pixels. It lists the tree,
     what each block shows right now, and how blocks are wired (reads / writes / calls). */
  function describe(doc, override, stateOverride) {
    var sysId = systemOf(doc, override), blocks = doc.blocks || {}, lines = [];
    var state = stateOverride || clone(doc.state || {}), locals = initLocals(doc, sysId), ctx = makeCtx(doc, sysId, state, locals);
    lines.push("Kage \"" + (doc.title || doc.id) + "\" · system " + sysId + (systems[sysId] ? "@" + systems[sysId].version : "") + " · " + Object.keys(blocks).length + " blocks");
    lines.push("state " + JSON.stringify(state));
    function short(v) { var t = JSON.stringify(v); return t && t.length > 60 ? t.slice(0, 57) + "…" : t; }
    function wiring(b) {
      var reads = [], writes = [], calls = [];
      walkExpr([b.props, b.bind, b.visible], function (op, arg) { if (op === "$state" || op === "$block" || op === "$data") { var rd = op.slice(1) + ":" + arg; if (reads.indexOf(rd) < 0) reads.push(rd); } });
      Object.keys(b.on || {}).forEach(function (ev) { (b.on[ev] || []).forEach(function (a) {
        if (a.do === "set" || a.do === "toggle") writes.push(ev + "→state." + a.path);
        if (a.do === "call") calls.push(ev + "→" + a.target + "." + a.command);
        if (a.do === "ask" || a.do === "agent" || a.do === "fetch" || a.do === "emit") calls.push(ev + "→" + a.do + (a.agent ? ":" + a.agent : "") + (a.into ? "⇒state." + a.into : ""));
      }); });
      var w = [];
      if (reads.length) w.push("reads " + reads.join(", "));
      if (writes.length) w.push("writes " + writes.join(", "));
      if (calls.length) w.push("calls " + calls.join(", "));
      return w.join(" · ");
    }
    function walk(id, depth, seen) {
      var pad = new Array(depth + 1).join("  "), b = blocks[id];
      if (!b || seen[id]) { lines.push(pad + "- " + id + " (missing)"); return; }
      seen[id] = true;
      var r = resolve(sysId, b.type), shown = true;
      if (b.visible !== undefined) { try { shown = !!evaluate(b.visible, merge(ctx, { self: id })); } catch (e) { shown = false; } }
      var head = pad + "- " + id + " [" + (r.ref || b.type) + "]" + (shown ? "" : " (hidden)");
      var out = {}; try { out = ctx.output(id) || {}; } catch (e) {}
      var keys = ["title", "label", "text", "value", "collapsed", "subtitle"].filter(function (k) { return out[k] !== undefined && out[k] !== null && out[k] !== ""; });
      if (out.rows) keys.push("rows");
      var facts = keys.map(function (k) { return k === "rows" ? "rows=" + out.rows.length : k + "=" + short(out[k]); });
      if (out.items) facts.push("items=" + out.items.map(function (i) { return i.id; }).join("|"));
      if (out.options) facts.push("options=" + out.options.map(function (o) { return o.value; }).join("|"));
      lines.push(head + (facts.length ? " " + facts.join(" ") : ""));
      var wr = wiring(b); if (wr) lines.push(pad + "    ↳ " + wr);
      var c = r.contract; if (!c) return;
      Object.keys(c.slots).forEach(function (sl) { var kids = (b.slots || {})[sl] || []; if (kids.length && Object.keys(c.slots).length > 1) lines.push(pad + "  " + sl + ":"); kids.forEach(function (k) { walk(k, depth + (Object.keys(c.slots).length > 1 ? 2 : 1), seen); }); });
    }
    walk(doc.root, 0, {});
    return lines.join("\n");
  }

  /* generationSchema(): compiles a design system into ONE strict JSON Schema that any model with
     structured outputs can be constrained to (every object closed, every key required, optional = nullable).
     Free-form values (expressions, actions, state, data, loosely typed props) travel as JSON strings
     ("*_json") and are parsed by fromGenerated(). */
  function strictOf(spec) {
    if (!spec || !spec.type) return null;
    var types = spec.type.split("|");
    if (types.length === 1 && types[0] === "array" && spec.items && strictOf(spec.items)) return { type: ["array", "null"], items: strictOf(spec.items) };
    if (types.length === 1 && types[0] === "object" && spec.properties) {
      var props = {}, req = [];
      Object.keys(spec.properties).forEach(function (k) { var sub = strictOf(spec.properties[k]); props[k] = sub || { type: ["string", "null"] }; req.push(k); });
      return { type: ["object", "null"], properties: props, required: req, additionalProperties: false };
    }
    if (types.every(function (t) { return t === "string" || t === "number" || t === "boolean"; })) {
      var o = { type: types.concat(["null"]) }; if (spec.enum) o.enum = spec.enum.concat([null]); return o;
    }
    return null; // not expressible strictly -> JSON string
  }
  function generationSchema(systemId) {
    var sys = systems[systemId], variants = [];
    Object.keys(sys.components).forEach(function (name) {
      var c = contracts[sys.components[name]], props = {}, preq = [], slots = {}, sreq = [];
      Object.keys(c.props).forEach(function (k) {
        var st = strictOf(c.props[k]);
        if (st) { props[k] = st; preq.push(k); } else { props[k + "_json"] = { type: ["string", "null"], description: "JSON-encoded value for `" + k + "`" }; preq.push(k + "_json"); }
      });
      Object.keys(c.slots).forEach(function (sl) { slots[sl] = { type: "array", items: { type: "string" } }; sreq.push(sl); });
      var evs = Object.keys(c.events), bindable = Object.keys(c.props);
      variants.push({ type: "object", description: c.ref + " — " + c.summary + (c.agent.use ? " Use: " + c.agent.use : ""), additionalProperties: false,
        required: ["id", "type", "props", "slots", "bind", "on", "visible_json"],
        properties: {
          id: { type: "string", description: "lowerCamel id, unique" },
          type: { type: "string", enum: [name] },
          props: { type: "object", properties: props, required: preq, additionalProperties: false },
          slots: { type: "object", properties: slots, required: sreq, additionalProperties: false },
          bind: { type: "array", items: { type: "object", additionalProperties: false, required: ["prop", "expr_json"], properties: { prop: { type: "string", enum: bindable.length ? bindable : ["_none"] }, expr_json: { type: "string", description: "A Kages expression as JSON, e.g. {\"$state\":\"region\"}" } } } },
          on: { type: "array", items: { type: "object", additionalProperties: false, required: ["event", "actions_json"], properties: { event: { type: "string", enum: evs.length ? evs : ["_none"] }, actions_json: { type: "string", description: "JSON array of actions" } } } },
          visible_json: { type: ["string", "null"], description: "Optional expression as JSON" }
        } });
    });
    return { $schema: "https://json-schema.org/draft/2020-12/schema", title: "Kage generation envelope for " + sys.name + " " + sys.version,
      type: "object", additionalProperties: false, required: ["title", "root", "state_json", "data_json", "blocks"],
      properties: {
        title: { type: "string" }, root: { type: "string" },
        state_json: { type: "string", description: "JSON object of initial app state" },
        data_json: { type: ["string", "null"], description: "JSON object of static datasets" },
        blocks: { type: "array", items: { anyOf: variants } }
      } };
  }
  function parseJ(s, fallback) { if (s == null || s === "") return fallback; try { return JSON.parse(s); } catch (e) { return { $parseError: String(e.message) }; } }
  function fromGenerated(gen, systemId) {
    var doc = { kages: "1.0", id: String(gen.title || "kage").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kage", title: gen.title, system: systemId + "@" + systems[systemId].version.split(".")[0], root: gen.root, state: parseJ(gen.state_json, {}), blocks: {} };
    var data = parseJ(gen.data_json, null); if (data) doc.data = data;
    (gen.blocks || []).forEach(function (g) {
      var b = { type: g.type }, props = {};
      Object.keys(g.props || {}).forEach(function (k) { var v = g.props[k]; if (v === null) return; if (/_json$/.test(k)) props[k.slice(0, -5)] = parseJ(v); else props[k] = stripNull(v); });
      if (Object.keys(props).length) b.props = props;
      var sl = {}; Object.keys(g.slots || {}).forEach(function (k) { if (g.slots[k].length) sl[k] = g.slots[k]; }); if (Object.keys(sl).length) b.slots = sl;
      if (g.bind && g.bind.length) { b.bind = {}; g.bind.forEach(function (x) { b.bind[x.prop] = parseJ(x.expr_json); }); }
      if (g.on && g.on.length) { b.on = {}; g.on.forEach(function (x) { b.on[x.event] = parseJ(x.actions_json, []); }); }
      if (g.visible_json) b.visible = parseJ(g.visible_json);
      doc.blocks[g.id] = b;
    });
    return doc;
  }
  function stripNull(v) { if (Array.isArray(v)) return v.map(stripNull); if (v && typeof v === "object") { var o = {}; for (var k in v) if (v[k] !== null) o[k] = stripNull(v[k]); return o; } return v; }
  function toGenerated(doc, systemId) {
    var sysId = systemId || systemOf(doc), out = { title: doc.title, root: doc.root, state_json: JSON.stringify(doc.state || {}), data_json: doc.data ? JSON.stringify(doc.data) : null, blocks: [] };
    Object.keys(doc.blocks).forEach(function (id) {
      var b = doc.blocks[id], r = resolve(sysId, b.type), c = r.contract, name = c.name, props = {}, slots = {};
      var own = merge(b.props || {}, ((b.props || {}).x || {})[sysId] || {});
      Object.keys(c.props).forEach(function (k) { var st = strictOf(c.props[k]), v = own[k]; if (st) props[k] = v === undefined || isExpr(v) ? null : fill(st, v); else props[k + "_json"] = v === undefined ? null : JSON.stringify(v); });
      Object.keys(c.slots).forEach(function (sl) { slots[sl] = (b.slots || {})[sl] || []; });
      out.blocks.push({ id: id, type: name, props: props, slots: slots,
        bind: Object.keys(b.bind || {}).map(function (k) { return { prop: k, expr_json: JSON.stringify(b.bind[k]) }; }),
        on: Object.keys(b.on || {}).map(function (k) { return { event: k, actions_json: JSON.stringify(b.on[k]) }; }),
        visible_json: b.visible === undefined ? null : JSON.stringify(b.visible) });
    });
    return out;
  }
  function fill(st, v) { // add explicit nulls so a value satisfies its strict schema
    if (v == null) return null;
    if (st.items && Array.isArray(v)) return v.map(function (x) { return fill(st.items, x); });
    if (st.properties && typeof v === "object") { var o = {}; Object.keys(st.properties).forEach(function (k) { o[k] = v[k] === undefined ? null : fill(st.properties[k], v[k]); }); return o; }
    return v;
  }

// Shared, framework-free extensions for the oracle and the pure engine. Keeping
// one implementation prevents an agent's generated formula or collection from
// validating on the server but behaving differently in the browser.
// See oracle/expressive-artifacts.feature.
const COMPUTE_OPERATORS = ["$literal", "$index", "$scope", "$input", "$add", "$sub", "$mul", "$div", "$mod", "$pow", "$min", "$max", "$round", "$lt", "$lte", "$gt", "$gte", "$concat", "$sort", "$format"];
const binary = ["$sub", "$div", "$mod", "$pow", "$lt", "$lte", "$gt", "$gte"];
const variadic = ["$add", "$mul", "$min", "$max", "$concat"];
const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);
const object = (o) => o != null && typeof o === "object" && !Array.isArray(o);
const finite = (n) => typeof n === "number" && Number.isFinite(n);
const safeKey = (s) => typeof s === "string" && s.split(".").every(k => k && !["__proto__", "constructor", "prototype"].includes(k));

/** Malformed operator shapes are rejected before evaluation; numeric domain
 * errors yield null so NaN/Infinity never escape into document state. */
function computationArgError(op, a) {
  if (binary.includes(op)) return Array.isArray(a) && a.length === 2 ? null : op + " takes [a, b]";
  if (variadic.includes(op)) return Array.isArray(a) && a.length > 0 ? null : op + " takes a nonempty array";
  if (op === "$round") return Array.isArray(a) && (a.length === 1 || a.length === 2) ? null : "$round takes [value, digits?]";
  if (["$scope", "$input"].includes(op)) return typeof a === "string" ? null : op + " takes a path string";
  if (op === "$index") return a === "" ? null : "$index takes an empty path string";
  if (op === "$sort") return object(a) && own(a, "list") && (a.field === undefined || typeof a.field === "string") && (a.direction === undefined || ["asc", "desc"].includes(a.direction)) ? null : "$sort takes {list, field?, direction?: asc|desc}";
  if (op === "$format") return object(a) && own(a, "value") && ["number", "currency", "percent", "date"].includes(a.style) && (a.digits === undefined || Number.isInteger(a.digits) && a.digits >= 0 && a.digits <= 10) && (a.currency === undefined || /^[A-Z]{3}$/.test(a.currency)) ? null : "$format takes {value, style: number|currency|percent|date, digits?: 0..10, currency?: ISO code}";
  return null;
}

/** Evaluate only closed operators; no coercive arithmetic, code, locale clock,
 * or mutable sorting. Formatting is pinned to en-US and UTC for reproducibility. */
function computeExpression(op, a, ctx, evaluate, getPath) {
  if (computationArgError(op, a)) return null;
  if (op === "$literal") return a;
  if (op === "$index") return ctx.index ?? null;
  if (op === "$scope") return getPath(ctx.scope, a);
  if (op === "$input") return getPath(ctx.input, a);
  if (op === "$concat") return a.map(v => evaluate(v, ctx)).map(v => v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)).join("");
  if (op === "$sort") {
    const list = evaluate(a.list, ctx);
    if (!Array.isArray(list)) return [];
    return list.map((value, i) => ({ value, i, key: a.field ? getPath(value, a.field) : value })).sort((x, y) => {
      const p = x.key, q = y.key;
      if (p == null) return q == null ? x.i - y.i : 1;
      if (q == null) return -1;
      const cmp = typeof p === "number" && typeof q === "number" ? p - q : String(p) < String(q) ? -1 : String(p) > String(q) ? 1 : 0;
      return (a.direction === "desc" ? -cmp : cmp) || x.i - y.i;
    }).map(x => x.value);
  }
  if (op === "$format") {
    const value = evaluate(a.value, ctx);
    try {
      if (a.style === "date") {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}(?:T.*(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return null;
        const date = new Date(value);
        return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date) : null;
      }
      if (!finite(value)) return null;
      const opts = { style: a.style, ...(a.style === "currency" ? { currency: a.currency || "USD" } : {}), ...(a.digits !== undefined ? { minimumFractionDigits: a.digits, maximumFractionDigits: a.digits } : {}) };
      return new Intl.NumberFormat("en-US", opts).format(value);
    } catch { return null; }
  }
  const v = a.map(x => evaluate(x, ctx));
  if (!v.every(finite)) return null;
  let result;
  switch (op) {
    case "$add": result = v.reduce((s, n) => s + n, 0); break;
    case "$sub": result = v[0] - v[1]; break;
    case "$mul": result = v.reduce((s, n) => s * n, 1); break;
    case "$div": result = v[1] === 0 ? null : v[0] / v[1]; break;
    case "$mod": result = v[1] === 0 ? null : v[0] % v[1]; break;
    case "$pow": result = Math.pow(v[0], v[1]); break;
    case "$min": result = Math.min(...v); break;
    case "$max": result = Math.max(...v); break;
    case "$round": {
      const digits = v[1] ?? 0;
      if (!Number.isInteger(digits) || digits < -10 || digits > 10) return null;
      const scale = Math.pow(10, digits); result = Math.round(v[0] * scale) / scale; break;
    }
    case "$lt": return v[0] < v[1];
    case "$lte": return v[0] <= v[1];
    case "$gt": return v[0] > v[1];
    case "$gte": return v[0] >= v[1];
  }
  return finite(result) ? result : null;
}

// Scope substitution uses $literal because item data may itself contain keys
// such as "$state". Recursively evaluating that data would turn an innocent
// dataset into a program. References are rebound to the same concrete instance.
function scopeValue(x, scope, ids, getPath, scopedItem = true) {
  if (Array.isArray(x)) return x.map(v => scopeValue(v, scope, ids, getPath, scopedItem));
  if (!object(x)) return x;
  const op = Object.keys(x)[0], a = x[op];
  if (op === "$literal") return x;
  if (!scopedItem && ["$item", "$index"].includes(op)) return x;
  if (op === "$map" && object(a)) return { $map: { ...scopeValue(a, scope, ids, getPath, scopedItem), to: scopeValue(a.to, scope, ids, getPath, false) } };
  if (["$item", "$index", "$scope", "$input"].includes(op)) {
    const value = op === "$index" ? scope.index : getPath(scope[op.slice(1)], a);
    return { $literal: value ?? null };
  }
  if (op === "$block" && typeof a === "string") {
    const dot = a.indexOf("."), id = dot < 0 ? a : a.slice(0, dot);
    return { $block: (ids[id] || id) + (dot < 0 ? "" : a.slice(dot)) };
  }
  if (op === "$tpl" && typeof a === "string") {
    const parts = []; let offset = 0;
    for (const m of a.matchAll(/\{\{\s*([a-zA-Z]+)\.([^}\s]+)\s*\}\}/g)) {
      parts.push(a.slice(offset, m.index), scopeValue({ ["$" + m[1]]: m[2] }, scope, ids, getPath, scopedItem)); offset = m.index + m[0].length;
    }
    parts.push(a.slice(offset)); return { $concat: parts };
  }
  const result = Object.fromEntries(Object.entries(x).map(([k, v]) => [k, scopeValue(v, scope, ids, getPath, scopedItem)]));
  if (["call", "setLocal"].includes(x.do) && typeof x.target === "string" && x.target !== "$self") result.target = ids[x.target] || x.target;
  return result;
}

/** Expand declarative templates into an ephemeral instance tree. Stored ids and
 * signatures stay untouched; stable typed keys preserve each control's locals.
 * Fail closed on ambiguous keys or cycles, with a bounded expansion budget. */
function expandDocument(doc, ctx, evaluate, getPath, createCtx) {
  if (!doc.compositions && !Object.values(doc.blocks || {}).some(b => b.repeat)) return doc;
  const blocks = Object.create(null), pins = Object.create(null);
  const reachable = new Set();
  function mark(id) { if (reachable.has(id)) return; reachable.add(id); for (const children of Object.values(doc.blocks[id]?.slots || {})) children.forEach(mark); }
  mark(doc.root);
  for (const [id, block] of Object.entries(doc.blocks)) if (!reachable.has(id) && !block.repeat) blocks[id] = block;
  let count = 0;
  function contextFor(source, scope, expression) {
    function scopedReference(x) {
      if (Array.isArray(x)) return x.some(scopedReference);
      if (!object(x) || Object.keys(x)[0] === "$literal") return false;
      if (Object.keys(x)[0] === "$block" && typeof x.$block === "string" && own(scope.ids, x.$block.split(".")[0])) return true;
      return Object.values(x).some(scopedReference);
    }
    // Most inputs read item/state data. Building a whole context for every card
    // would make a large collection quadratic; only scoped output reads need it.
    if (!createCtx || !scopedReference(expression)) return ctx;
    const scoped = Object.fromEntries(Object.entries(scope.ids || {}).filter(([id]) => own(source, id)).map(([id, uid]) => [uid, scopeValue(source[id], scope, scope.ids, getPath)]));
    return createCtx({ ...doc, blocks: { ...doc.blocks, ...scoped, ...blocks } });
  }
  function visit(id, source, prefix, scope, ancestry, definitions) {
    if (ancestry.includes(id) || ancestry.length > 64 || definitions.length > 64) throw new Error("Composition/slot cycle at " + id);
    const b = source[id]; if (!b) throw new Error("Missing template " + id);
    // A repeat instance includes the template id as well as its typed key.
    // Independent repeat blocks with the same row keys must not share locals.
    if (b.repeat) {
      const each = evaluate(scopeValue(b.repeat.each, scope, scope.ids || {}, getPath), contextFor(source, scope, b.repeat.each));
      if (!Array.isArray(each)) throw new Error("repeat.each must evaluate to an array at " + id);
      const keys = new Set();
      return each.flatMap((item, index) => {
        const key = b.repeat.key ? getPath(item, b.repeat.key) : index;
        if (!(typeof key === "string" || finite(key))) throw new Error("repeat.key must be a string or finite number at " + id);
        const token = JSON.stringify(key);
        if (keys.has(token)) throw new Error("Duplicate repeat key " + token + " at " + id); keys.add(token);
        const instancePrefix = prefix + "/" + encodeURIComponent(id + ":" + token).replace(/\./g, "%2E");
        const descendants = new Set();
        function collect(k) { if (descendants.has(k)) return; descendants.add(k); for (const children of Object.values(source[k]?.slots || {})) children.forEach(collect); }
        collect(id);
        const ids = { ...scope.ids, ...Object.fromEntries([...descendants].map(k => [k, k + "~" + instancePrefix])) };
        const next = { ...scope, ids, item, index, scope: { ...scope.scope, ...(b.repeat.as ? { [b.repeat.as]: item } : {}) } };
        return visitOne(id, b, source, instancePrefix, next, ancestry, definitions);
      });
    }
    return visitOne(id, b, source, prefix, scope, ancestry, definitions);
  }
  function visitOne(id, b, source, prefix, scope, ancestry, definitions) {
    if (++count > 10000) throw new Error("Artifact exceeds 10000 rendered blocks");
    const uid = prefix ? id + "~" + prefix : id;
    const ids = scope.ids || {};
    const copy = scopeValue(b, scope, ids, getPath); delete copy.repeat;
    blocks[uid] = copy;
    if (doc.resolved?.blocks?.[(scope.pinPrefix || "") + id]) pins[uid] = doc.resolved.blocks[(scope.pinPrefix || "") + id];
    copy.slots = Object.fromEntries(Object.entries(b.slots || {}).map(([slot, children]) => [slot, children.flatMap(child => visit(child, source, prefix, scope, [...ancestry, id], definitions))]));
    if (b.type === "composition") {
      const name = b.props?.name, definition = own(doc.compositions, name) ? doc.compositions[name] : undefined;
      if (!definition) throw new Error("Unknown composition " + name);
      if (definitions.includes(name)) throw new Error("Recursive composition " + name);
      const input = evaluate(scopeValue(b.bind?.inputs || b.props?.inputs || {}, scope, ids, getPath), contextFor(source, scope, b.bind?.inputs || b.props?.inputs));
      if (!object(input)) throw new Error("Composition inputs must evaluate to an object at " + id);
      for (const key of Object.keys(input)) if (!own(definition.inputs || {}, key)) throw new Error("Unknown composition input " + key + " at " + id);
      const values = { ...Object.fromEntries(Object.entries(definition.inputs || {}).filter(([, s]) => s.default !== undefined).map(([k, s]) => [k, s.default])), ...input };
      for (const [key, spec] of Object.entries(definition.inputs || {})) {
        if ((spec.required && values[key] === undefined) || (values[key] !== undefined && !matchesInput(spec, values[key]))) throw new Error("Invalid composition input " + key + " at " + id);
      }
      const nextScope = { ...scope, pinPrefix: "compositions/" + name + "/", input: values, ids: { ...scope.ids, ...Object.fromEntries(Object.keys(definition.blocks).map(k => [k, k + "~" + prefix + "/" + encodeURIComponent(id + ":" + name)])) } };
      copy.slots.children = visit(definition.root, definition.blocks, prefix + "/" + encodeURIComponent(id + ":" + name), nextScope, [], [...definitions, name]);
      if (definition.output !== undefined) {
        const localIds = Object.fromEntries(Object.keys(definition.blocks).map(k => [k, k + "~" + prefix + "/" + encodeURIComponent(id + ":" + name)]));
        copy.bind = { ...copy.bind, value: scopeValue(definition.output, nextScope, localIds, getPath) };
      }
    }
    return [uid];
  }
  const roots = visit(doc.root, doc.blocks, "", { scope: {} }, [], []);
  let root = roots[0];
  if (roots.length !== 1) { root = "collection~root"; blocks[root] = { type: "stack", slots: { children: roots } }; }
  return { ...doc, root, blocks, resolved: doc.resolved ? { ...doc.resolved, blocks: pins } : undefined };
}

/** Check authoring errors on templates, including dormant definitions and
 * empty collections. Runtime expansion alone would hide those mistakes. */
function advancedFindings(doc, baseValidate, isExpr, walkExpr, contractFor) {
  const errors = [];
  const fail = (at, code, msg) => errors.push({ at, code, msg });
  const definitions = doc.compositions || {};
  function checkBlocks(blocks, base) {
    const parent = new Map();
    for (const [id, b] of Object.entries(blocks || {})) for (const children of Object.values(b.slots || {})) for (const child of children) parent.set(child, id);
    function repeats(id) { const ids = new Set(), seen = new Set(); while (id && !seen.has(id)) { seen.add(id); if (blocks[id]?.repeat) ids.add(id); id = parent.get(id); } return ids; }
    for (const [id, b] of Object.entries(blocks || {})) {
      const at = base + "/" + id;
      const scope = repeats(id);
      function checkReference(arg) {
        const target = arg.split(".")[0];
        if ([...repeats(target)].some(r => !scope.has(r))) fail(at, "ambiguous-instance", "Reference to repeated block " + target + " must be inside the same repeat scope");
      }
      walkExpr([b.props, b.bind, b.on, b.visible], (op, arg) => {
        if (op === "$block" && typeof arg === "string") checkReference(arg);
        if (op === "$tpl" && typeof arg === "string") for (const m of arg.matchAll(/\{\{\s*block\.([^}\s]+)\s*\}\}/g)) checkReference(m[1]);
      });
      for (const actions of Object.values(b.on || {})) for (const action of Array.isArray(actions) ? actions : []) { if (action.do === "call" && action.target !== "$self" && [...repeats(action.target)].some(r => !scope.has(r))) fail(at, "ambiguous-instance", "Call to a repeated block must be inside the same repeat scope"); }
      const c = contractFor ? contractFor(b.type) : null;
      for (const [slot, children] of Object.entries(b.slots || {})) if (c?.slots?.[slot]?.max && children.some(child => blocks[child]?.repeat)) fail(at + "/slots/" + slot, "repeat-slot-limit", "Place repeated blocks inside an unbounded container to respect slot cardinality");
      if (b.repeat !== undefined) {
        const r = b.repeat;
        if (!object(r) || !own(r, "each") || (r.as !== undefined && (typeof r.as !== "string" || !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(r.as) || !safeKey(r.as))) || (r.key !== undefined && !safeKey(r.key)) || Object.keys(r).some(k => !["each", "as", "key"].includes(k))) fail(at + "/repeat", "bad-repeat", "repeat takes {each, as?: alias, key?: item path}");
        else if (!isExpr(r.each) && !Array.isArray(r.each)) fail(at + "/repeat/each", "bad-repeat", "repeat.each must be an array or expression");
      }
      walkExpr([b.props, b.bind, b.on, b.visible, b.repeat?.each], (op, arg) => {
        const error = computationArgError(op, arg); if (error) fail(at, "bad-expr", error);
      });
      if (b.type === "composition") {
        const def = own(definitions, b.props?.name) ? definitions[b.props.name] : undefined;
        if (!def) { fail(at, "missing-composition", "Unknown composition " + b.props?.name); continue; }
        const values = b.props?.inputs || {};
        for (const [key, spec] of Object.entries(def.inputs || {})) {
          const value = values[key];
          if (spec.required && value === undefined && !own(b.bind || {}, "inputs") && spec.default === undefined) fail(at + "/props/inputs/" + key, "missing-input", "Composition requires " + key);
          if (value !== undefined && !isExpr(value) && !matchesInput(spec, value)) fail(at + "/props/inputs/" + key, "input-type", "Input " + key + " should be " + spec.type);
        }
        for (const key of Object.keys(values)) if (!own(def.inputs || {}, key)) fail(at + "/props/inputs/" + key, "unknown-input", "Unknown composition input " + key);
      }
    }
  }
  if (doc.compositions !== undefined && !object(doc.compositions)) fail("/compositions", "bad-composition", "compositions must be an object");
  checkBlocks(doc.blocks, "/blocks");
  for (const [name, def] of Object.entries(definitions)) {
    const at = "/compositions/" + name;
    if (typeof name !== "string" || !/^[a-z][a-zA-Z0-9_-]{0,47}$/.test(name) || !safeKey(name) || !object(def) || !object(def.blocks) || !object(def.inputs) || typeof def.root !== "string") { fail(at, "bad-composition", "Composition needs typed inputs, root and blocks"); continue; }
    for (const [key, spec] of Object.entries(def.inputs)) if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,47}$/.test(key) || !safeKey(key) || !object(spec) || !["string", "number", "boolean", "array", "object"].includes(spec.type) || (spec.default !== undefined && !matchesInput(spec, spec.default))) fail(at + "/inputs/" + key, "bad-input", "Inputs need a safe name, JSON type and compatible default");
    if (def.outputType && (!object(def.outputType) || typeof def.outputType.type !== "string" || !def.outputType.type.split("|").every(t => ["string", "number", "boolean", "array", "object", "null"].includes(t)))) fail(at + "/outputType", "bad-output", "Output needs a JSON type");
    let outputId = "compositionOutput"; while (own(def.blocks, outputId)) outputId += "X";
    const check = def.output === undefined ? { ...doc, root: def.root, blocks: def.blocks } : { ...doc, root: outputId, blocks: { ...def.blocks, [outputId]: { type: "composition", props: { name }, bind: { value: def.output }, slots: { children: [def.root] } } } };
    const result = baseValidate({ ...check, compositions: undefined });
    for (const e of result.errors) fail(e.at === "/blocks/" + outputId ? at + "/output" : at + e.at, e.code, e.msg);
    checkBlocks(def.blocks, at + "/blocks");
    walkExpr([def.blocks, def.output], (op, arg) => { if (op === "$input" && typeof arg === "string" && !own(def.inputs, arg.split(".")[0])) fail(at, "unknown-input", "Undeclared $input " + arg); });
    walkExpr(def.output, (op, arg) => { const error = computationArgError(op, arg); if (error) fail(at + "/output", "bad-expr", error); });
  }
  const colors = new Map();
  function visitDefinition(name, chain) {
    if (colors.get(name) === 1) { fail("/compositions/" + name, "composition-cycle", "Recursive composition: " + [...chain, name].join(" → ")); return; }
    if (colors.get(name) === 2 || !own(definitions, name)) return;
    colors.set(name, 1);
    for (const block of Object.values(definitions[name]?.blocks || {})) if (block.type === "composition") visitDefinition(block.props?.name, [...chain, name]);
    colors.set(name, 2);
  }
  for (const name of Object.keys(definitions)) visitDefinition(name, []);
  return errors;
}

/** Input contracts accept JSON values only; expressions are checked after they
 * resolve as well, so a state update cannot bypass a reusable component's type. */
function matchesInput(spec, value) {
  return typeof spec.type === "string" && spec.type.split("|").some(type => type === "null" ? value === null : value != null && (type === "array" ? Array.isArray(value) : type === "object" ? object(value) : type === "number" ? finite(value) : typeof value === type)) && (!spec.enum || spec.enum.includes(value));
}

/* Extend the reference's public operations together. Old contracts stay intact;
 * shared pure capabilities supply only the new semantics and error findings. */
  OPS = OPS.concat(COMPUTE_OPERATORS);
  var baseEvaluate = evaluate;
  evaluate = function (x, ctx) {
    var op = x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x)[0] : null;
    return COMPUTE_OPERATORS.indexOf(op) >= 0 ? computeExpression(op, x[op], ctx, evaluate, getPath) : baseEvaluate(x, ctx);
  };
  var baseValidate = validate;
  validate = function (doc, override) {
    var result = baseValidate(doc, override);
    var errors = advancedFindings(doc, function (d) { return baseValidate(d, override); }, isExpr, walkExpr, function (type) { return resolve(result.system, type).contract; });
    if (result.ok && !errors.length) {
      try { var expanded = expandDocument(doc, makeCtx(doc, result.system, doc.state || {}, initLocals(doc, result.system)), evaluate, getPath, function (d) { return makeCtx(d, result.system, doc.state || {}, initLocals(d, result.system)); });
        var ctx = makeCtx(expanded, result.system, doc.state || {}, initLocals(expanded, result.system));
        Object.keys(expanded.blocks).forEach(function (id) { var b = expanded.blocks[id]; if (b.type === "composition" && doc.compositions && doc.compositions[b.props.name] && doc.compositions[b.props.name].outputType) ctx.output(id); });
      }
      catch (e) { errors.push({ at: "/blocks", code: "bad-expansion", msg: e.message }); }
    }
    return merge(result, { ok: result.ok && !errors.length, errors: result.errors.concat(errors) });
  };
  var baseDescribe = describe;
  describe = function (doc, override, state) {
    var sys = systemOf(doc, override), count = Object.keys(doc.blocks || {}).length;
    var expanded = expandDocument(doc, makeCtx(doc, sys, state || doc.state || {}, initLocals(doc, sys)), evaluate, getPath, function (d) { return makeCtx(d, sys, state || doc.state || {}, initLocals(d, sys)); });
    var text = baseDescribe(expanded, override, state);
    var instances = Object.keys(expanded.blocks).length;
    return text.replace(" · " + instances + " blocks\n", " · " + count + " blocks" + (instances !== count ? " · " + instances + " instances" : "") + "\n");
  };
  var baseSchema = generationSchema;
  generationSchema = function (sys) {
    var schema = baseSchema(sys);
    schema.required.splice(4, 0, "compositions_json");
    schema.properties.compositions_json = { type: ["string", "null"], description: "JSON object of local compositions: typed inputs, root, blocks, optional output" };
    schema.properties.blocks.items.anyOf.forEach(function (v) {
      v.required.push("repeat_json");
      v.properties.repeat_json = { type: ["string", "null"], description: "Repeat template: JSON {each, as?, key?}; null for one instance" };
    });
    return schema;
  };
  var baseToGenerated = toGenerated;
  toGenerated = function (doc, sys) {
    var envelope = baseToGenerated(doc, sys);
    envelope.compositions_json = doc.compositions ? JSON.stringify(doc.compositions) : null;
    envelope.blocks.forEach(function (g) {
      var b = doc.blocks[g.id], c = resolve(systemOf(doc, sys), b.type).contract;
      g.repeat_json = b.repeat === undefined ? null : JSON.stringify(b.repeat);
      var props = merge(b.props || {}, ((b.props || {}).x || {})[systemOf(doc, sys)] || {});
      var expressions = {};
      Object.keys(props).forEach(function (key) { if (c.props[key] && strictOf(c.props[key]) && isExpr(props[key])) expressions[key] = props[key]; });
      expressions = merge(expressions, b.bind || {});
      g.bind = Object.keys(expressions).map(function (key) { return { prop: key, expr_json: JSON.stringify(expressions[key]) }; });
    });
    return envelope;
  };
  var baseFromGenerated = fromGenerated;
  fromGenerated = function (g, sys) {
    var doc = baseFromGenerated(g, sys);
    var compositions = parseJ(g.compositions_json, null); if (compositions) doc.compositions = compositions;
    (g.blocks || []).forEach(function (b) { if (b.repeat_json) doc.blocks[b.id].repeat = parseJ(b.repeat_json); });
    return doc;
  };

  var api = {
    version: "1.0.0",
    CoreShell: CoreShell, CoreSidebar: CoreSidebar, CoreDropdown: CoreDropdown, CoreTabs: CoreTabs, CoreButton: CoreButton, CoreTextInput: CoreTextInput, CoreCard: CoreCard, CoreStack: CoreStack, CoreText: CoreText, CoreBadge: CoreBadge, CoreStat: CoreStat, CoreTable: CoreTable,
    LedgerSidebar: LedgerSidebar, LedgerDropdown: LedgerDropdown, LedgerTabs: LedgerTabs, LedgerButton: LedgerButton, LedgerCard: LedgerCard, LedgerStat: LedgerStat,
    AtelierSidebar: AtelierSidebar, AtelierDropdown: AtelierDropdown, AtelierTabs: AtelierTabs, AtelierButton: AtelierButton, AtelierCard: AtelierCard, AtelierStat: AtelierStat,
    KageRenderer: KageRenderer,
    systems: systems, contracts: contracts, interfaces: interfaces, actions: ACTIONS, resolve: resolve, evaluate: evaluate, validate: validate, catalog: catalog,
    describe: describe, generationSchema: generationSchema, toGenerated: toGenerated, fromGenerated: fromGenerated
  };
  Object.keys(freeFlowExports).forEach(function (name) { api[name] = freeFlowExports[name]; });
  W.Kages = W.Kages || {};
  for (var k in api) W.Kages[k] = api[k];
})();
