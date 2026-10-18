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
      // A citation is a superscript link to the matching item of a `references`
      // block on the same page. The target id is the namespaced slug, so author
      // text can never become an arbitrary DOM id.
      var cite = typeof run.cite === "string" && anchorId(run.cite) ? anchorId("ref-" + run.cite) : undefined;
      if (cite) return h("sup", { key: i, className: "kg-cite" }, h("a", { href: "#" + cite, "aria-label": "Source " + run.text }, child));
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
      var body = node.runs ? richRuns(node.runs) : String(node.text || "");
      // Attribution sits outside the blockquote, in a figcaption (HTML's own
      // pattern for a cited quotation); a link on it is passive like any other.
      if (node.kind === "quote" && typeof node.attribution === "string" && node.attribution) {
        var from = passiveLink(node.href);
        return h("figure", { key: i, className: "kg-quote" }, h("blockquote", null, body), h("figcaption", null, from ? h("a", { href: from, rel: "noopener noreferrer" }, node.attribution) : node.attribution));
      }
      return h(tag, { key: i }, body);
    }));
  }
  /** Field-level validation message: announced when it appears, tied to its input
   *  through aria-describedby/aria-invalid by each field. Text only. */
  function fieldError(p, id) { return p.error ? h("span", { id: id, className: "kg-field__error", role: "alert" }, String(p.error)) : null; }
  function describedBy(uid, p) { var ids = [p.help ? uid + "-help" : null, p.error ? uid + "-err" : null].filter(Boolean).join(" "); return ids || undefined; }
  function CoreComposition(p) { return h("div", { className: "kg-composition" }, p.children); }
  function CoreTextField(p) {
    var uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: choice(p.kind, ["text", "email", "url"], "text"), "aria-label": p.label, "aria-describedby": describedBy(uid, p), "aria-invalid": p.error ? true : undefined, name: p.name, value: p.value == null ? "" : p.value, required: p.required, minLength: p.minLength, maxLength: p.maxLength, placeholder: p.placeholder, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }), p.help ? h("span", { id: uid + "-help", className: "kg-field__help" }, p.help) : null, fieldError(p, uid + "-err"));
  }
  function CoreNumberInput(p) {
    var uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: "number", "aria-describedby": describedBy(uid, p), "aria-invalid": p.error ? true : undefined, name: p.name, value: typeof p.value === "number" && isFinite(p.value) ? p.value : "", min: p.min, max: p.max, step: typeof p.step === "number" && p.step > 0 ? p.step : "any", required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: isFinite(e.target.valueAsNumber) ? e.target.valueAsNumber : null }); } }), fieldError(p, uid + "-err"));
  }
  function CoreDateInput(p) {
    var uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("input", { className: "kg-input", type: "date", "aria-describedby": describedBy(uid, p), "aria-invalid": p.error ? true : undefined, name: p.name, value: p.value || "", min: p.min, max: p.max, required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: e.target.value }); } }), fieldError(p, uid + "-err"));
  }
  function CoreChoice(p) {
    var uid = R().useId();
    return h("fieldset", { className: "kg-choice", disabled: p.disabled, "aria-describedby": p.error ? uid + "-err" : undefined, "aria-invalid": p.error ? true : undefined }, h("legend", { className: "kg-field__label" }, p.label),
      (Array.isArray(p.options) ? p.options : []).map(function (o, i) { return h("label", { key: i }, h("input", { type: "radio", name: p.name || uid, value: o.value, checked: p.value === o.value, required: p.required, onChange: function () { fire(p.onChange, { value: o.value }); } }), h("span", null, o.label)); }), fieldError(p, uid + "-err"));
  }
  function CoreMultiselect(p) {
    var selected = Array.isArray(p.value) ? p.value : [], uid = R().useId();
    return h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, p.label),
      h("select", { className: "kg-input kg-multiselect", name: p.name, "aria-label": p.label, "aria-describedby": uid + "-help" + (p.error ? " " + uid + "-err" : ""), "aria-invalid": p.error ? true : undefined, multiple: true, value: selected, required: p.required, disabled: p.disabled,
        onChange: function (e) { fire(p.onChange, { value: Array.from(e.target.selectedOptions).map(function (o) { return o.value; }) }); } }, (Array.isArray(p.options) ? p.options : []).map(function (o, i) { return h("option", { key: i, value: o.value }, o.label); })),
      h("span", { id: uid + "-help", className: "kg-field__help" }, "Choose multiple with Ctrl or Command; use arrow keys and Shift on the keyboard."), fieldError(p, uid + "-err"));
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
  // A wide figure is drawn in a fixed coordinate space and scaled to fit; on a
  // phone that shrinks its labels to unreadable. Give it a minimum width of 80%
  // of its drawing width inside a scrolling figure instead.
  function wideStyle(w) { return w >= 480 ? { minWidth: Math.round(w * .8) } : undefined; }
  function CoreScene(p) {
    var width = Math.max(1, finiteNumber(p.width, 640)), height = Math.max(1, finiteNumber(p.height, 360));
    return h("figure", { className: "kg-scene" + (width >= 480 ? " kg-scene--wide" : "") }, h("figcaption", null, p.caption || p.label),
      h("svg", { style: wideStyle(width), viewBox: "0 0 " + width + " " + height, role: p.interactive ? "group" : "img", "aria-label": p.label }, h("title", null, p.label),
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
    // Labelled edges need a gap wider than their chip, or the label hides under the
    // nodes it connects; widen the automatic columns only when labels exist.
    var labelled = (Array.isArray(p.edges) ? p.edges : []).some(function (e) { return e && typeof e.label === "string" && e.label; }), colStep = labelled ? 300 : 220, labelShapes = [];
    nodes.forEach(function (n, i) { positions[n.id] = { x: finiteNumber(n.x, 20 + (i % 3) * colStep), y: finiteNumber(n.y, 30 + Math.floor(i / 3) * 140) }; });
    // Edges run between node boundaries (not centres, which hid every arrowhead
    // under the boxes), end in a two-stroke arrowhead, and carry their label on
    // a paper-coloured chip so text stays legible where it crosses the line.
    (Array.isArray(p.edges) ? p.edges : []).slice(0, 400).forEach(function (edge) {
      var from = positions[edge.from], to = positions[edge.to]; if (!from || !to || edge.from === edge.to) return;
      var ax = from.x + 90, ay = from.y + 35, bx = to.x + 90, by = to.y + 35, dx = bx - ax, dy = by - ay, len = Math.sqrt(dx * dx + dy * dy);
      if (!isFinite(len) || len < 1) return;
      var ux = dx / len, uy = dy / len;
      // Distance from a rectangle's centre to its edge along the edge direction.
      var clip = Math.min(ux ? 90 / Math.abs(ux) : Infinity, uy ? 35 / Math.abs(uy) : Infinity) + 4;
      if (clip * 2 >= len) return; // boxes overlap or touch: no room for a line
      var sx = ax + ux * clip, sy = ay + uy * clip, ex = bx - ux * clip, ey = by - uy * clip;
      function r1(n) { return Math.round(n * 10) / 10; }
      shapes.push({ kind: "line", x: r1(sx), y: r1(sy), x2: r1(ex), y2: r1(ey), stroke: "ink-muted", strokeWidth: 2, label: edge.label || edge.from + " to " + edge.to });
      [.45, -.45].forEach(function (a) {
        var c = Math.cos(a), sn = Math.sin(a);
        shapes.push({ kind: "line", x: r1(ex), y: r1(ey), x2: r1(ex - (ux * c - uy * sn) * 12), y2: r1(ey - (ux * sn + uy * c) * 12), stroke: "ink-muted", strokeWidth: 2 });
      });
      if (typeof edge.label === "string" && edge.label) {
        var text = edge.label.slice(0, 24), w = Math.max(24, text.length * 7 + 12), mx = (sx + ex) / 2, my = (sy + ey) / 2;
        labelShapes.push({ kind: "rect", x: r1(mx - w / 2), y: r1(my - 11), width: w, height: 22, radius: 6, fill: "paper", stroke: "line", strokeWidth: 1 });
        labelShapes.push({ kind: "text", x: r1(mx - w / 2 + 6), y: r1(my + 5), text: text, size: 13, fill: "ink" });
      }
    });
    nodes.forEach(function (n) {
      var pos = positions[n.id]; width = Math.max(width, pos.x + 200); height = Math.max(height, pos.y + 100);
      shapes.push({ kind: "rect", id: n.id, x: pos.x, y: pos.y, width: 180, height: 70, fill: n.tone || "surface", label: n.label });
      shapes.push({ kind: "text", x: pos.x + 12, y: pos.y + 42, text: String(n.label || n.id).slice(0, 20), label: n.label });
    });
    // Labels go on the top layer so a chip that is wider than the gap stays readable.
    labelShapes.forEach(function (sh) { shapes.push(sh); });
    return CoreScene({ label: p.label, caption: p.caption, width: width, height: height, shapes: shapes, interactive: p.interactive, onSelect: p.onSelect });
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

  var CONTROL_PROPS = { label: S("string", { required: true }), name: S("string"), required: S("boolean"), disabled: S("boolean"), error: S("string") };
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
    scene: { summary: "Responsive vector scene assembled from rect/circle/line/path/text geometry and token colors.", props: { label: S("string", { required: true }), width: S("number", { default: 640 }), height: S("number", { default: 360 }), shapes: S("array", { required: true, items: S("object", { requiredKeys: ["kind"] }) }), interactive: S("boolean"), caption: S("string") }, events: { select: { payload: { id: "string" } } } },
    diagram: { summary: "Node and edge diagram with automatic placement or explicit coordinates.", props: { label: S("string", { required: true }), nodes: S("array", { required: true, items: S("object", { requiredKeys: ["id", "label"] }) }), edges: S("array", { items: S("object", { requiredKeys: ["from", "to"] }) }), interactive: S("boolean"), caption: S("string") }, events: { select: { payload: { id: "string" } } } },
    "line-chart": { summary: "Responsive numeric X/Y line chart with an accessible data table.", props: PLOT_PROPS },
    "scatter-chart": { summary: "Responsive numeric X/Y scatter plot with an accessible data table.", props: PLOT_PROPS }
  };
  var EXPRESSIVE_NOTES = {
    composition: "Define doc.compositions[name] with typed inputs, root, blocks, optional output expression and outputType:{type,enum?}. Use $input inside the definition; read instance.value outside. Definitions expand to ordinary installed blocks; never contain HTML or executable code.",
    link: "Use HTTPS/HTTP, local / paths, #anchors or mailto links. Provide meaningful label text.",
    "rich-text": "nodes kinds: paragraph, heading (level 2/3/4), quote (optional attribution and href), list (items, ordered), code. Prose accepts text or runs [{text,bold?,italic?,code?,href?,cite?}]. A run with cite:\"id\" and text:\"1\" is a superscript link to the references item with that id; the number is the item's position. Strings remain literal.",
    "text-field": "Use inside form with name and required/minLength/maxLength; email and url use browser validity. change emits {value}. Set error to show a field-level message (bind it to a $if over state for custom rules).",
    "number-input": "Use for calculations; an empty field emits null. Set name inside form; change emits {value}.",
    "date-input": "Date values and bounds are YYYY-MM-DD; change emits {value}.",
    choice: "Use for one option from a short list; options are [{value,label}]. change emits {value}.",
    multiselect: "Use for several choices; options are [{value,label}], value is a string array. change emits {value}.",
    form: "Place named native fields in children. Invalid fields prevent submit. submit emits {values}: string values, duplicate names become arrays. Wire submit to declared state or a host action.",
    scene: "shapes: {kind:rect|circle|line|path|text,id?,label?,x?,y?,width?,height?,radius?,x2?,y2?,d?,text?,size?,fill?,stroke?,strokeWidth?}. Colors: accent, ink, ink-muted, line, surface, sunken, paper, success, danger; no arbitrary SVG attributes. interactive shapes with id emit select {id} and support Enter/Space. label is the accessible name; caption is the visible sentence under the figure saying what to take from it (it replaces the label as the visible caption).",
    diagram: "nodes: [{id,label,x?,y?,tone?}], edges: [{from,to,label?}]. Coordinates are optional. interactive nodes emit select {id}. caption is the visible takeaway under the figure.",
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
    // Fields gained the optional `error` prop: a minor contract release.
    core[name] = contract("core", name, /^(text-field|number-input|date-input|choice|multiselect|rich-text|scene|diagram)$/.test(name) ? "1.1.0" : "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "focus"], agent: { use: EXPRESSIVE_NOTES[name] } });
  });
