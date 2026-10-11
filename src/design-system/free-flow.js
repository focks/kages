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
