/* Batch 2 of the rich-artifact roles: work-app, input and media blocks.
 * Runs after rich.js in the reference closure and reuses its helpers (r2,
 * richNum, dataTable). Everything is built from React nodes and native
 * controls: markdown and TeX are parsed into elements, never into HTML, so a
 * hostile string can only ever become text. See oracle/rich-artifacts.feature. */
  function dayKey(y, m, d) { return y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0"); }
  function optList(options) { return (Array.isArray(options) ? options : []).filter(function (o) { return o && typeof o.value === "string"; }).slice(0, 500).map(function (o) { return { value: o.value, label: String(o.label == null ? o.value : o.label) }; }); }

  function CoreSwitch(p) {
    var on = !!p.checked;
    return h("div", { className: "kg-switch" }, h("button", { type: "button", role: "switch", "aria-checked": on, "aria-label": p.label, disabled: p.disabled, className: "kg-switch__track" + (on ? " kg-switch__track--on" : ""), onClick: function () { fire(p.onChange, { checked: !on }); } }, h("span", { className: "kg-switch__thumb" })), h("span", { className: "kg-switch__label", "aria-hidden": "true" }, p.label));
  }

  function CoreCombobox(p) {
    var R_ = R(), uid = R_.useId(), options = optList(p.options), st = R_.useState(null), query = st[0], setQuery = st[1], ac = R_.useState(0), active = ac[0], setActive = ac[1];
    var selected = options.filter(function (o) { return o.value === p.value; })[0], open = query !== null;
    var shown = open ? options.filter(function (o) { return o.label.toLowerCase().indexOf(String(query).toLowerCase()) >= 0; }) : [];
    var at = Math.min(active, Math.max(0, shown.length - 1));
    function choose(o) { fire(p.onChange, { value: o.value }); setQuery(null); setActive(0); }
    return h("div", { className: "kg-field kg-free-field kg-combobox" }, h("label", { className: "kg-field__label", htmlFor: uid + "-in" }, p.label),
      h("input", { id: uid + "-in", className: "kg-input", role: "combobox", "aria-expanded": open, "aria-controls": uid + "-list", "aria-autocomplete": "list", "aria-activedescendant": open && shown.length ? uid + "-o" + at : undefined, autoComplete: "off", name: p.name, placeholder: p.placeholder, disabled: p.disabled, required: p.required,
        value: open ? query : selected ? selected.label : "",
        onFocus: function () { setQuery(""); },
        onBlur: function () { setQuery(null); },
        onChange: function (e) { setQuery(e.target.value); setActive(0); },
        onKeyDown: function (e) {
          if (e.key === "ArrowDown") { e.preventDefault(); if (!open) setQuery(""); else setActive(Math.min(shown.length - 1, at + 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(Math.max(0, at - 1)); }
          else if (e.key === "Enter" && open && shown[at]) { e.preventDefault(); choose(shown[at]); }
          else if (e.key === "Escape" && open) { e.preventDefault(); setQuery(null); }
        } }),
      open ? h("ul", { id: uid + "-list", role: "listbox", "aria-label": p.label, className: "kg-combobox__list" }, shown.length ? shown.map(function (o, i) {
        // onMouseDown (not click) so the input's blur does not close the list first.
        return h("li", { key: o.value, id: uid + "-o" + i, role: "option", "aria-selected": o.value === p.value, className: "kg-combobox__opt" + (i === at ? " kg-combobox__opt--active" : ""), onMouseDown: function (e) { e.preventDefault(); choose(o); } }, o.label);
      }) : h("li", { className: "kg-combobox__none", role: "presentation" }, p.empty || "No matches")) : null);
  }

  function CoreTree(p) {
    var R_ = R(), ex = R_.useState(null), expandedState = ex[0], setExpanded = ex[1], count = 0;
    function clean(list, depth) {
      if (!Array.isArray(list) || depth > 8) return [];
      return list.filter(function (n) { return n && typeof n.id === "string" && count++ < 500; }).map(function (n) { return { id: n.id, label: String(n.label == null ? n.id : n.label), children: clean(n.children, depth + 1) }; });
    }
    var nodes = clean(p.nodes, 0);
    var expanded = expandedState || (function () { var s = Object.create(null); (function walk(l) { l.forEach(function (n) { if (p.expandAll) s[n.id] = true; walk(n.children); }); })(nodes); return s; })();
    function toggle(id, value) { var s = Object.create(null); Object.keys(expanded).forEach(function (k) { s[k] = expanded[k]; }); s[id] = value; setExpanded(s); }
    function move(e, delta) {
      var items = Array.from(e.currentTarget.closest("[role=tree]").querySelectorAll("[role=treeitem] > .kg-tree__row")), i = items.indexOf(e.currentTarget) + delta;
      if (items[i]) { e.preventDefault(); items[i].focus(); }
    }
    function render(list, level) {
      return h("ul", { role: level ? "group" : "tree", "aria-label": level ? undefined : p.label, className: "kg-tree" + (level ? " kg-tree--nested" : "") }, list.map(function (n) {
        var branch = n.children.length > 0, open = !!expanded[n.id];
        return h("li", { key: n.id, role: "treeitem", "aria-expanded": branch ? open : undefined, "aria-selected": p.value === n.id, "aria-level": level + 1 },
          h("button", { type: "button", className: "kg-tree__row" + (p.value === n.id ? " kg-tree__row--on" : ""), onClick: function () { if (branch) toggle(n.id, !open); fire(p.onSelect, { id: n.id }); },
            onKeyDown: function (e) {
              if (e.key === "ArrowDown") move(e, 1); else if (e.key === "ArrowUp") move(e, -1);
              else if (e.key === "ArrowRight" && branch && !open) { e.preventDefault(); toggle(n.id, true); }
              else if (e.key === "ArrowLeft" && branch && open) { e.preventDefault(); toggle(n.id, false); }
            } }, h("span", { className: "kg-tree__twist", "aria-hidden": "true" }, branch ? (open ? "▾" : "▸") : ""), n.label),
          branch && open ? render(n.children, level + 1) : null);
      }));
    }
    return nodes.length ? render(nodes, 0) : h("p", null, p.empty || "Nothing to show");
  }

  function CoreDataGrid(p) {
    var R_ = R(), columns = (Array.isArray(p.columns) ? p.columns : []).filter(function (c) { return c && typeof c.key === "string"; }).slice(0, 30);
    var rows = (Array.isArray(p.rows) ? p.rows : []).filter(function (r) { return r && typeof r === "object"; }).slice(0, 5000);
    var s1 = R_.useState({ key: null, dir: 1 }), sort = s1[0], setSort = s1[1], s2 = R_.useState(""), q = s2[0], setQ = s2[1], s3 = R_.useState(0), page = s3[0], setPage = s3[1];
    var size = Math.max(1, Math.min(100, Math.floor(richNum(p.pageSize, 10)))), uid = R_.useId();
    var indexed = rows.map(function (r, i) { return { row: r, index: i }; });
    var term = q.toLowerCase();
    if (term) indexed = indexed.filter(function (e) { return columns.some(function (c) { return String(e.row[c.key] == null ? "" : e.row[c.key]).toLowerCase().indexOf(term) >= 0; }); });
    if (sort.key) indexed = indexed.slice().sort(function (a, b) {
      var x = a.row[sort.key], y = b.row[sort.key], nx = typeof x === "number", ny = typeof y === "number", c = nx && ny ? x - y : String(x == null ? "" : x).localeCompare(String(y == null ? "" : y), "en");
      // Original position breaks ties so repeated clicks never shuffle equals.
      return (c || a.index - b.index) * (c ? sort.dir : 1);
    });
    var pages = Math.max(1, Math.ceil(indexed.length / size)), cur = Math.min(page, pages - 1), view = indexed.slice(cur * size, cur * size + size);
    return h("div", { className: "kg-grid-data" },
      p.filterable ? h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, "Filter " + p.label), h("input", { className: "kg-input", type: "search", value: q, "aria-label": "Filter " + p.label, onChange: function (e) { setQ(e.target.value); setPage(0); } })) : null,
      h("div", { className: "kg-grid-data__scroll" }, h("table", { className: "kg-grid-data__table", "aria-label": p.label },
        h("thead", null, h("tr", null, columns.map(function (c) {
          var on = sort.key === c.key;
          return h("th", { key: c.key, scope: "col", "aria-sort": on ? (sort.dir > 0 ? "ascending" : "descending") : "none" }, p.sortable === false ? c.label : h("button", { type: "button", className: "kg-grid-data__sort", onClick: function () { setSort({ key: c.key, dir: on ? -sort.dir : 1 }); setPage(0); } }, c.label, h("span", { "aria-hidden": "true" }, on ? (sort.dir > 0 ? " ▲" : " ▼") : "")));
        }))),
        h("tbody", null, view.length ? view.map(function (e) {
          var picked = !!p.selected && JSON.stringify(p.selected) === JSON.stringify(e.row);
          return h("tr", { key: e.index, tabIndex: 0, "aria-selected": !!picked, className: "kg-grid-data__row" + (picked ? " kg-grid-data__row--on" : ""),
            onClick: function () { fire(p.onSelect, { row: e.row, index: e.index }); },
            onKeyDown: function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); fire(p.onSelect, { row: e.row, index: e.index }); } } },
            columns.map(function (c) { var v = e.row[c.key]; return h("td", { key: c.key, className: typeof v === "number" ? "kg-grid-data__num" : undefined }, v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v)); }));
        }) : h("tr", null, h("td", { colSpan: Math.max(1, columns.length) }, p.empty || "No rows"))))),
      pages > 1 ? h("div", { className: "kg-grid-data__pager" }, h("button", { type: "button", className: "kg-btn", disabled: cur === 0, onClick: function () { setPage(cur - 1); } }, "Previous"), h("span", { id: uid + "-pg", "aria-live": "polite" }, "Page " + (cur + 1) + " of " + pages), h("button", { type: "button", className: "kg-btn", disabled: cur >= pages - 1, onClick: function () { setPage(cur + 1); } }, "Next")) : null);
  }

  function CoreKanban(p) {
    var cols = (Array.isArray(p.columns) ? p.columns : []).filter(function (c) { return c && typeof c.id === "string"; }).slice(0, 12);
    var cards = (Array.isArray(p.board) ? p.board : Array.isArray(p.cards) ? p.cards : []).filter(function (c) { return c && typeof c.id === "string"; }).slice(0, 1000);
    function moveTo(card, to) { fire(p.onMove, { id: card.id, from: card.column, to: to, cards: cards.map(function (c) { return c.id === card.id ? Object.assign({}, c, { column: to }) : c; }) }); }
    return h("div", { className: "kg-kanban", role: "group", "aria-label": p.label }, cols.map(function (col, ci) {
      var mine = cards.filter(function (c) { return c.column === col.id; });
      return h("section", { key: col.id, className: "kg-kanban__col", "aria-label": col.title + ", " + mine.length + " cards" }, h("h3", { className: "kg-kanban__title" }, col.title, h("span", { className: "kg-kanban__count" }, mine.length)),
        h("ul", { className: "kg-kanban__cards" }, mine.map(function (card) {
          return h("li", { key: card.id, className: "kg-kanban__card" }, h("strong", null, String(card.title == null ? card.id : card.title)), card.description ? h("p", null, String(card.description)) : null,
            h("div", { className: "kg-kanban__moves" },
              ci > 0 ? h("button", { type: "button", className: "kg-btn", "aria-label": "Move " + card.title + " to " + cols[ci - 1].title, onClick: function () { moveTo(card, cols[ci - 1].id); } }, "←") : null,
              ci < cols.length - 1 ? h("button", { type: "button", className: "kg-btn", "aria-label": "Move " + card.title + " to " + cols[ci + 1].title, onClick: function () { moveTo(card, cols[ci + 1].id); } }, "→") : null));
        })));
    }));
  }

  function CoreCalendar(p) {
    var R_ = R(), m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(p.month || "")), off = R_.useState(0), offset = off[0], setOffset = off[1];
    if (!m) return h("p", { className: "kg-missing", role: "alert" }, "Calendar month must look like 2026-03.");
    var total = Number(m[1]) * 12 + Number(m[2]) - 1 + offset, year = Math.floor(total / 12), month = ((total % 12) + 12) % 12;
    var first = new Date(Date.UTC(year, month, 1)), days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(), start = p.weekStart === 0 ? 0 : 1, lead = (first.getUTCDay() - start + 7) % 7;
    var byDate = Object.create(null); (Array.isArray(p.events) ? p.events : []).slice(0, 2000).forEach(function (e) { if (e && typeof e.date === "string") (byDate[e.date] = byDate[e.date] || []).push(e); });
    var names = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"], head = names.slice(start).concat(names.slice(0, start)), cells = [];
    for (var i = 0; i < lead; i++) cells.push(h("td", { key: "l" + i, className: "kg-calendar__pad" }));
    for (var d = 1; d <= days; d++) (function (day) {
      var key = dayKey(year, month, day), ev = byDate[key] || [], on = p.value === key;
      cells.push(h("td", { key: key }, h("button", { type: "button", className: "kg-calendar__day" + (on ? " kg-calendar__day--on" : ""), "aria-pressed": on, "aria-label": key + (ev.length ? ", " + ev.length + " events: " + ev.map(function (e) { return e.title; }).join(", ") : ""), onClick: function () { fire(p.onChange, { value: key }); } }, h("span", null, day), ev.length ? h("span", { className: "kg-calendar__dot", "aria-hidden": "true" }) : null)));
    })(d);
    var weeks = []; for (var w = 0; w < cells.length; w += 7) weeks.push(h("tr", { key: w }, cells.slice(w, w + 7)));
    var picked = byDate[p.value] || [];
    return h("div", { className: "kg-calendar" }, h("div", { className: "kg-calendar__bar" }, h("button", { type: "button", className: "kg-btn", "aria-label": "Previous month", onClick: function () { setOffset(offset - 1); } }, "‹"),
      h("strong", { "aria-live": "polite" }, ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"][month] + " " + year),
      h("button", { type: "button", className: "kg-btn", "aria-label": "Next month", onClick: function () { setOffset(offset + 1); } }, "›")),
      h("table", { className: "kg-calendar__grid", "aria-label": p.label }, h("thead", null, h("tr", null, head.map(function (n) { return h("th", { key: n, scope: "col" }, n); }))), h("tbody", null, weeks)),
      picked.length ? h("ul", { className: "kg-calendar__events" }, picked.map(function (e, i) { return h("li", { key: i }, String(e.title)); })) : null);
  }

  function CoreCarousel(p) {
    var slides = (Array.isArray(p.slides) ? p.slides : []).filter(Boolean).slice(0, 50), uid = R().useId();
    if (!slides.length) return h("p", null, p.empty || "No slides");
    var at = Math.max(0, Math.min(slides.length - 1, Math.floor(richNum(p.index, 0)))), s = slides[at], src = s.src ? imageSource(s.src) : undefined;
    function go(i) { fire(p.onChange, { index: (i + slides.length) % slides.length }); }
    return h("section", { className: "kg-carousel", "aria-roledescription": "carousel", "aria-label": p.label, onKeyDown: function (e) { if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); } } },
      h("div", { id: uid + "-s", className: "kg-carousel__slide", role: "group", "aria-roledescription": "slide", "aria-label": (at + 1) + " of " + slides.length, "aria-live": "polite" },
        src ? h("img", { src: src, alt: s.alt || "", loading: "lazy", decoding: "async" }) : null, s.title ? h("h3", null, String(s.title)) : null, s.text ? h("p", null, String(s.text)) : null),
      h("div", { className: "kg-carousel__bar" }, h("button", { type: "button", className: "kg-btn", "aria-controls": uid + "-s", onClick: function () { go(at - 1); } }, "Previous"),
        h("span", { className: "kg-carousel__dots" }, slides.map(function (_, i) { return h("button", { key: i, type: "button", className: "kg-carousel__dot" + (i === at ? " kg-carousel__dot--on" : ""), "aria-label": "Slide " + (i + 1), "aria-current": i === at ? "true" : undefined, onClick: function () { go(i); } }); })),
        h("button", { type: "button", className: "kg-btn", "aria-controls": uid + "-s", onClick: function () { go(at + 1); } }, "Next")));
  }

  /* ---- TeX math -> React elements -------------------------------------------
   * A real (subset) TeX math engine: parse to an AST, render to elements. There
   * is no HTML path, so hostile input can only become text; every loop is
   * budgeted (input length, node budget, nesting depth, matrix size) so a crafted
   * string cannot hang the renderer; unknown commands render as their name. */
  var TEX_GREEK = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η", theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π", varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "ϕ", varphi: "φ", chi: "χ", psi: "ψ", omega: "ω" };
  var TEX_SYMBOLS = { Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ", Phi: "Φ", Psi: "Ψ", Omega: "Ω",
    cdot: "⋅", times: "×", div: "÷", pm: "±", mp: "∓", ast: "∗", star: "⋆", circ: "∘", bullet: "∙", oplus: "⊕", otimes: "⊗", ominus: "⊖", odot: "⊙",
    leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", equiv: "≡", sim: "∼", simeq: "≃", cong: "≅", propto: "∝", ll: "≪", gg: "≫", prec: "≺", succ: "≻",
    in: "∈", notin: "∉", ni: "∋", subset: "⊂", supset: "⊃", subseteq: "⊆", supseteq: "⊇", cup: "∪", cap: "∩", setminus: "∖", emptyset: "∅", varnothing: "∅",
    land: "∧", wedge: "∧", lor: "∨", vee: "∨", neg: "¬", lnot: "¬", forall: "∀", exists: "∃", nexists: "∄", therefore: "∴", because: "∵",
    infty: "∞", partial: "∂", nabla: "∇", ell: "ℓ", hbar: "ℏ", Re: "ℜ", Im: "ℑ", aleph: "ℵ", prime: "′", angle: "∠", perp: "⊥", parallel: "∥", degree: "°", dagger: "†",
    to: "→", rightarrow: "→", leftarrow: "←", leftrightarrow: "↔", Rightarrow: "⇒", Leftarrow: "⇐", Leftrightarrow: "⇔", implies: "⇒", iff: "⇔", mapsto: "↦", uparrow: "↑", downarrow: "↓", longrightarrow: "⟶", longleftarrow: "⟵",
    ldots: "…", dots: "…", cdots: "⋯", vdots: "⋮", ddots: "⋱", lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉", vert: "|", Vert: "‖", lvert: "|", rvert: "|", lVert: "‖", rVert: "‖", backslash: "\\", ",": "", "{": "{", "}": "}", "|": "‖", "%": "%", "$": "$", "&": "&", "#": "#", "_": "_" };
  var TEX_BIGOPS = { sum: "∑", prod: "∏", coprod: "∐", int: "∫", iint: "∬", iiint: "∭", oint: "∮", bigcup: "⋃", bigcap: "⋂", bigoplus: "⨁", bigotimes: "⨂", bigvee: "⋁", bigwedge: "⋀" };
  var TEX_NAMED_OPS = { sin: 0, cos: 0, tan: 0, cot: 0, sec: 0, csc: 0, arcsin: 0, arccos: 0, arctan: 0, sinh: 0, cosh: 0, tanh: 0, coth: 0, log: 0, ln: 0, lg: 0, exp: 0, deg: 0, dim: 0, ker: 0, hom: 0, arg: 0, lim: 1, limsup: 1, liminf: 1, max: 1, min: 1, sup: 1, inf: 1, det: 1, gcd: 1, Pr: 1 };
  var TEX_ACCENT = { hat: "^", widehat: "^", bar: "‾", overline: "‾", vec: "→", overrightarrow: "→", tilde: "~", widetilde: "~", dot: "˙", ddot: "¨", underline: "_" };
  var TEX_ENVS = { matrix: ["", ""], pmatrix: ["(", ")"], bmatrix: ["[", "]"], Bmatrix: ["{", "}"], vmatrix: ["|", "|"], Vmatrix: ["‖", "‖"], cases: ["{", ""], aligned: ["", ""], align: ["", ""], gather: ["", ""], split: ["", ""], array: ["", ""] };
  var TEX_SPACE = { ",": .17, ":": .22, ";": .28, "!": -.17, " ": .28, quad: 1, qquad: 2 };
  var TEX_DELIM = { "(": "(", ")": ")", "[": "[", "]": "]", "|": "|", ".": "", "/": "/", "<": "⟨", ">": "⟩", "{": "{", "}": "}", lbrace: "{", rbrace: "}", langle: "⟨", rangle: "⟩", lvert: "|", rvert: "|", vert: "|", lVert: "‖", rVert: "‖", "|\\": "‖", lfloor: "⌊", rfloor: "⌋", lceil: "⌈", rceil: "⌉" };
  // Stretchy delimiters are drawn as non-uniformly scaled SVG paths so a fence
  // grows with its content instead of staying one glyph tall.
  var TEX_DELIM_PATH = { "(": "M8 0Q1 50 8 100", ")": "M2 0Q9 50 2 100", "[": "M8 1H2V99H8", "]": "M2 1H8V99H2", "|": "M5 0V100", "‖": "M3 0V100M7 0V100", "{": "M8 1Q4 1 4 20V40Q4 50 1 50Q4 50 4 60V80Q4 99 8 99", "}": "M2 1Q6 1 6 20V40Q6 50 9 50Q6 50 6 60V80Q6 99 2 99", "⟨": "M8 0L2 50L8 100", "⟩": "M2 0L8 50L2 100", "⌊": "M3 0V99H8", "⌋": "M7 0V99H2", "⌈": "M3 100V1H8", "⌉": "M7 100V1H2" };
  var BB_EXC = { C: "ℂ", H: "ℍ", N: "ℕ", P: "ℙ", Q: "ℚ", R: "ℝ", Z: "ℤ" }, CAL_EXC = { B: "ℬ", E: "ℰ", F: "ℱ", H: "ℋ", I: "ℐ", L: "ℒ", M: "ℳ", R: "ℛ" }, FRAK_EXC = { C: "ℭ", H: "ℌ", I: "ℑ", R: "ℜ", Z: "ℨ" };
  function texAlpha(c, style) {
    var up = c >= "A" && c <= "Z", lo = c >= "a" && c <= "z"; if (!up && !lo) return c;
    var k = c.charCodeAt(0) - (up ? 65 : 97);
    if (style === "bb") return up ? (BB_EXC[c] || String.fromCodePoint(0x1D538 + k)) : String.fromCodePoint(0x1D552 + k);
    if (style === "cal") return up ? (CAL_EXC[c] || String.fromCodePoint(0x1D49C + k)) : c;
    if (style === "frak") return up ? (FRAK_EXC[c] || String.fromCodePoint(0x1D504 + k)) : String.fromCodePoint(0x1D51E + k);
    return c;
  }
  function texParse(src) {
    var i = 0, budget = 4000;
    function ws() { while (i < src.length && /\s/.test(src[i])) i++; }
    function name() { var m = /^[A-Za-z]+/.exec(src.slice(i, i + 24)); if (m) { i += m[0].length; return m[0]; } return i < src.length ? src[i++] : ""; }
    // Raw (unparsed) braced text for \text{...}; depth-balanced and length-bounded.
    function raw() { ws(); if (src[i] !== "{") return i < src.length ? src[i++] : ""; i++; var d = 1, out = ""; while (i < src.length && budget-- > 0) { var c = src[i++]; if (c === "{") d++; else if (c === "}") { if (--d === 0) break; } out += c; } return out.slice(0, 200); }
    function group(depth) { return { t: "group", items: seq(depth + 1).items }; }
    function arg(depth) {
      ws(); if (i >= src.length) return { t: "group", items: [] };
      if (src[i] === "{") { i++; return depth < 8 ? group(depth) : { t: "group", items: [] }; }
      if (src[i] === "\\") { i++; return command(name(), depth) || { t: "group", items: [] }; }
      return atom(src[i++]);
    }
    function atom(c) {
      if (/[A-Za-z]/.test(c)) return { t: "var", v: c };
      if (c === "+" || c === "-") return { t: "bin", v: c === "-" ? "−" : c };
      if (c === "=" || c === "<" || c === ">") return { t: "rel", v: c };
      if (c === "*") return { t: "bin", v: "∗" };
      if (c === "," || c === ";") return { t: "punct", v: c };
      return { t: "sym", v: c };
    }
    function attach(items, kind, node) {
      var last = items[items.length - 1];
      if (last && last.t === "scripts" && !last[kind]) { last[kind] = node; return; }
      items.push({ t: "scripts", base: items.pop() || { t: "group", items: [] }, sup: kind === "sup" ? node : null, sub: kind === "sub" ? node : null });
    }
    function delim() { ws(); if (i >= src.length) return ""; var c = src[i++]; if (c === "\\") { var n = name(); return TEX_DELIM[n] !== undefined ? TEX_DELIM[n] : ""; } return TEX_DELIM[c] !== undefined ? TEX_DELIM[c] : ""; }
    function environment(env, depth) {
      var spec = TEX_ENVS[env.replace("*", "")]; if (!spec) return { t: "text", v: env };
      if (env === "array") raw();
      var rows = [], cur = [];
      while (budget-- > 0 && rows.length < 50) {
        var r = seq(depth + 1); cur.push({ t: "group", items: r.items });
        if (r.end === "&") { if (cur.length >= 20) { rows.push(cur); i = src.length; break; } continue; }
        if (r.end === "\\\\") { rows.push(cur); cur = []; continue; }
        if (cur.length > 1 || cur[0].items.length) rows.push(cur);
        break;
      }
      return { t: "matrix", rows: rows, open: spec[0], close: spec[1], align: /^(aligned|align|split)/.test(env) ? "al" : env === "cases" ? "cases" : env === "gather" ? "gather" : "c" };
    }
    function command(n, depth) {
      if (TEX_GREEK[n]) return { t: "var", v: TEX_GREEK[n] };
      if (TEX_SPACE[n] !== undefined) return { t: "space", w: TEX_SPACE[n] };
      if (TEX_BIGOPS[n]) return { t: "bigop", v: TEX_BIGOPS[n], limits: n !== "int" && n !== "iint" && n !== "iiint" && n !== "oint" };
      if (TEX_NAMED_OPS[n] !== undefined) return { t: "op", v: n, limits: !!TEX_NAMED_OPS[n] };
      if (TEX_ACCENT[n]) return { t: "accent", kind: n, body: arg(depth) };
      if (TEX_SYMBOLS[n] !== undefined) { var v = TEX_SYMBOLS[n]; return /^(leq|le|geq|ge|neq|ne|approx|equiv|sim|simeq|cong|propto|ll|gg|prec|succ|in|notin|ni|subset|supset|subseteq|supseteq|to|rightarrow|leftarrow|leftrightarrow|Rightarrow|Leftarrow|Leftrightarrow|implies|iff|mapsto|longrightarrow|longleftarrow)$/.test(n) ? { t: "rel", v: v } : /^(pm|mp|times|div|cdot|ast|star|circ|bullet|oplus|otimes|ominus|odot|cup|cap|setminus|land|lor|wedge|vee)$/.test(n) ? { t: "bin", v: v } : { t: "sym", v: v }; }
      switch (n) {
        case "frac": case "dfrac": case "tfrac": case "cfrac": { var a = arg(depth), b = arg(depth); return { t: "frac", num: a, den: b }; }
        case "binom": case "dbinom": { var a2 = arg(depth), b2 = arg(depth); return { t: "fenced", open: "(", close: ")", body: [{ t: "frac", num: a2, den: b2, bar: false }] }; }
        case "sqrt": { ws(); var idx = null; if (src[i] === "[") { var e = src.indexOf("]", i); if (e > i && e - i < 12) { idx = src.slice(i + 1, e); i = e + 1; } } return { t: "sqrt", idx: idx, body: arg(depth) }; }
        case "text": case "textrm": case "mbox": case "textit": case "textbf": case "operatorname": return { t: "text", v: raw(), style: n === "textit" ? "it" : n === "textbf" ? "bf" : n === "operatorname" ? "op" : "rm" };
        case "mathrm": return { t: "styled", style: "rm", body: arg(depth) };
        case "mathbf": case "boldsymbol": case "bm": return { t: "styled", style: "bf", body: arg(depth) };
        case "mathit": return { t: "styled", style: "it", body: arg(depth) };
        case "mathsf": return { t: "styled", style: "sf", body: arg(depth) };
        case "mathtt": return { t: "styled", style: "tt", body: arg(depth) };
        case "mathbb": return { t: "styled", style: "bb", body: arg(depth) };
        case "mathcal": case "mathscr": return { t: "styled", style: "cal", body: arg(depth) };
        case "mathfrak": return { t: "styled", style: "frak", body: arg(depth) };
        case "left": { var open = delim(), r = seq(depth + 1); return { t: "fenced", open: open, close: r.end === "right" ? r.extra : "", body: r.items }; }
        case "big": case "Big": case "bigg": case "Bigg": case "bigl": case "bigr": case "Bigl": case "Bigr": { var d = delim(); return { t: "sym", v: d }; }
        case "begin": return environment(raw(), depth);
        case "limits": case "nolimits": case "displaystyle": case "textstyle": case "scriptstyle": case "nonumber": case "notag": case "hline": return null;
        case "\\": return { t: "break" };
        default: return { t: "text", v: n, style: "rm" };
      }
    }
    function seq(depth) {
      var items = [], end = "eof", extra = "";
      while (i < src.length) {
        if (budget-- <= 0) { i = src.length; break; }
        var c = src[i];
        if (/\s/.test(c)) { i++; continue; }
        // A stray closer at the top level must not silently drop the rest of the formula.
        if (c === "}") { i++; if (depth === 0) continue; end = "}"; break; }
        if (c === "&") { i++; end = "&"; break; }
        if (c === "{") { i++; if (depth < 8) items.push(group(depth)); continue; }
        if (c === "^" || c === "_") { i++; attach(items, c === "^" ? "sup" : "sub", arg(depth)); continue; }
        if (c === "'") { i++; attach(items, "sup", { t: "sym", v: "′" }); continue; }
        if (c === "\\") {
          i++; var n = name();
          if (n === "\\") { end = "\\\\"; break; }
          if (n === "end") { raw(); end = "end"; break; }
          if (n === "right") { extra = delim(); end = "right"; break; }
          var node = command(n, depth); if (node) items.push(node); continue;
        }
        items.push(atom(c)); i++;
      }
      return { items: items, end: end, extra: extra };
    }
    return seq(0).items;
  }
  function texFence(ch, key) {
    var d = TEX_DELIM_PATH[ch]; if (!d) return ch ? h("span", { key: key, className: "kg-math__delim" }, ch) : null;
    return h("svg", { key: key, className: "kg-math__fence", viewBox: "0 0 10 100", preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" }, h("path", { d: d, fill: "none", stroke: "currentColor", strokeWidth: 1.4, vectorEffect: "non-scaling-stroke" }));
  }
  function texRender(items, display, style) {
    function many(list, st) { return list.map(function (n, k) { return h(R().Fragment, { key: k }, one(n, st)); }); }
    function one(n, st) {
      if (!n) return null;
      switch (n.t) {
        case "group": return many(n.items, st);
        case "var": return h("span", { className: "kg-math__var" + (st === "rm" || st === "bf" || st === "sf" || st === "tt" ? " kg-math__rm" : "") + (st === "bf" ? " kg-math__bf" : "") + (st === "sf" ? " kg-math__sf" : "") + (st === "tt" ? " kg-math__tt" : "") }, texAlpha(n.v, st));
        case "sym": return h("span", { className: "kg-math__sym" + (st === "bf" ? " kg-math__bf" : "") }, st === "bb" || st === "cal" || st === "frak" ? texAlpha(n.v, st) : n.v);
        case "bin": return h("span", { className: "kg-math__bin" }, n.v);
        case "rel": return h("span", { className: "kg-math__rel" }, n.v);
        case "punct": return h("span", { className: "kg-math__punct" }, n.v);
        case "space": return h("span", { className: "kg-math__space", style: { width: Math.max(-.3, Math.min(3, n.w)) + "em" } });
        case "break": return h("br");
        case "text": return h("span", { className: "kg-math__text" + (n.style === "it" ? " kg-math__it" : n.style === "bf" ? " kg-math__bf" : "") }, n.v);
        case "styled": return many(n.body.t === "group" ? n.body.items : [n.body], n.style);
        case "op": return h("span", { className: "kg-math__op" }, n.v);
        case "bigop": return h("span", { className: "kg-math__bigop" }, n.v);
        case "frac": return h("span", { className: "kg-math__frac" + (n.bar === false ? " kg-math__frac--nobar" : "") }, h("span", { className: "kg-math__num" }, one(n.num, st)), h("span", { className: "kg-math__den" }, one(n.den, st)));
        case "sqrt": return h("span", { className: "kg-math__sqrt" }, n.idx ? h("sup", { className: "kg-math__rootidx" }, n.idx) : null, "√", h("span", { className: "kg-math__radicand" }, one(n.body, st)));
        case "accent": return h("span", { className: "kg-math__accent kg-math__accent--" + n.kind }, h("span", { className: "kg-math__mark", "aria-hidden": "true" }, TEX_ACCENT[n.kind]), h("span", null, one(n.body, st)));
        case "scripts": {
          var stacked = display && n.base && (n.base.t === "bigop" || n.base.t === "op") && n.base.limits;
          if (stacked) return h("span", { className: "kg-math__limits" }, n.sup ? h("span", { className: "kg-math__over" }, one(n.sup, st)) : null, h("span", null, one(n.base, st)), n.sub ? h("span", { className: "kg-math__under" }, one(n.sub, st)) : null);
          return h(R().Fragment, null, one(n.base, st), n.sup && n.sub ? h("span", { className: "kg-math__ss" }, h("sup", null, one(n.sup, st)), h("sub", null, one(n.sub, st))) : n.sup ? h("sup", null, one(n.sup, st)) : h("sub", null, one(n.sub, st)));
        }
        case "fenced": return h("span", { className: "kg-math__fenced" }, texFence(n.open, "o"), h("span", { className: "kg-math__inner" }, many(n.body, st)), texFence(n.close, "c"));
        case "matrix": {
          var cols = n.rows.reduce(function (m, r) { return Math.max(m, r.length); }, 1);
          var grid = h("span", { className: "kg-math__matrix kg-math__matrix--" + n.align, style: { gridTemplateColumns: "repeat(" + cols + ", auto)" } }, n.rows.map(function (r, ri) { return r.map(function (cell, ci) { return h("span", { key: ri + "-" + ci, className: "kg-math__cell" + (n.align === "al" ? (ci % 2 ? " kg-math__cell--l" : " kg-math__cell--r") : "") }, one(cell, st)); }); }));
          return n.open || n.close ? h("span", { className: "kg-math__fenced" }, texFence(n.open, "o"), grid, texFence(n.close, "c")) : grid;
        }
        default: return null;
      }
    }
    return many(items, style);
  }
  function CoreMath(p) {
    var tex = String(p.tex == null ? "" : p.tex).slice(0, 2000);
    return h(p.display ? "div" : "span", { className: "kg-math" + (p.display ? " kg-math--display" : ""), role: "math", "aria-label": p.label || tex }, texRender(texParse(tex), !!p.display));
  }

  function inlineMd(text, base) {
    var out = [], re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)\s]+\)|\$[^$\n]+\$)/g, last = 0, m, k = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push(text.slice(last, m.index));
      var t = m[0];
      if (t[0] === "`") out.push(h("code", { key: base + k++ }, t.slice(1, -1)));
      else if (t.slice(0, 2) === "**") out.push(h("strong", { key: base + k++ }, t.slice(2, -2)));
      else if (t[0] === "*") out.push(h("em", { key: base + k++ }, t.slice(1, -1)));
      else if (t[0] === "$") out.push(h("span", { key: base + k++ }, CoreMath({ tex: t.slice(1, -1) })));
      else { var lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t), href = passiveLink(lm[2]); out.push(href ? h("a", { key: base + k++, href: href, rel: "noopener noreferrer" }, lm[1]) : lm[1]); }
      last = m.index + t.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
  }
  function CoreMarkdown(p) {
    var lines = String(p.text == null ? "" : p.text).slice(0, 50000).split(/\r?\n/), out = [], i = 0, key = 0;
    while (i < lines.length) {
      var line = lines[i], m;
      if (!line.trim()) { i++; continue; }
      if (/^```/.test(line)) { var code = []; i++; while (i < lines.length && !/^```/.test(lines[i])) code.push(lines[i++]); i++; out.push(h("pre", { key: key++ }, h("code", null, code.join("\n")))); continue; }
      if (/^\$\$/.test(line.trim())) { var tex = []; var first = line.trim().slice(2); if (/\$\$$/.test(first)) { tex.push(first.slice(0, -2)); i++; } else { if (first) tex.push(first); i++; while (i < lines.length && !/\$\$/.test(lines[i])) tex.push(lines[i++]); if (i < lines.length) tex.push(lines[i].split("$$")[0]); i++; } out.push(h(CoreMath, { key: key++, tex: tex.join(" "), display: true })); continue; }
      if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { out.push(h("h" + (m[1].length + 1), { key: key++ }, inlineMd(m[2], "h"))); i++; continue; }
      if (/^---+\s*$/.test(line)) { out.push(h("hr", { key: key++ })); i++; continue; }
      if (/^>\s?/.test(line)) { var q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, "")); out.push(h("blockquote", { key: key++ }, inlineMd(q.join(" "), "q"))); continue; }
      if (/^\s*([-*]|\d+\.)\s+/.test(line)) { var ordered = /^\s*\d+\./.test(line), items = []; while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, "")); out.push(h(ordered ? "ol" : "ul", { key: key++ }, items.map(function (t, j) { return h("li", { key: j }, inlineMd(t, "li")); }))); continue; }
      var para = []; while (i < lines.length && lines[i].trim() && !/^(```|#{1,3}\s|>|---|\s*([-*]|\d+\.)\s|\$\$)/.test(lines[i])) para.push(lines[i++]);
      out.push(h("p", { key: key++ }, inlineMd(para.join(" "), "p")));
    }
    return h("div", { className: "kg-rich-text kg-markdown" }, out);
  }

  var OPTS = S("array", { required: true, items: S("object", { properties: { value: S("string"), label: S("string") }, requiredKeys: ["value", "label"] }) });
  var TREE_NODE = S("object", { requiredKeys: ["id"] });
  var APPS = {
    "switch": { summary: "Labelled on/off toggle with a public checked state.", props: { label: S("string", { required: true }), checked: S("boolean"), disabled: S("boolean") }, local: { checked: { type: "boolean", default: false } }, events: { change: { payload: { checked: "boolean" } } }, outputs: ["checked"] },
    combobox: { summary: "Type-to-filter single choice with a keyboard listbox; the value is always one of the options.", props: { label: S("string", { required: true }), options: OPTS, value: S("string"), name: S("string"), placeholder: S("string"), empty: S("string"), required: S("boolean"), disabled: S("boolean") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    tree: { summary: "Expandable hierarchy with keyboard navigation and a selected node id.", props: { label: S("string", { required: true }), nodes: S("array", { required: true, items: TREE_NODE }), value: S("string"), expandAll: S("boolean"), empty: S("string") }, local: { value: { type: "string", default: "" } }, events: { select: { payload: { id: "string" } } }, outputs: ["value"] },
    "data-grid": { summary: "Sortable, filterable, paged table whose rows can be selected.", props: { label: S("string", { required: true }), columns: S("array", { required: true, items: S("object", { properties: { key: S("string"), label: S("string") }, requiredKeys: ["key", "label"] }) }), rows: S("array", { required: true }), pageSize: S("number", { default: 10 }), filterable: S("boolean"), sortable: S("boolean", { default: true }), empty: S("string") }, local: { selected: { type: "object|null", default: null } }, events: { select: { payload: { row: "object", index: "number" } } }, outputs: ["selected"] },
    kanban: { summary: "Columns of cards that move between columns with buttons; the moved board is public.", props: { label: S("string", { required: true }), columns: S("array", { required: true, items: S("object", { properties: { id: S("string"), title: S("string") }, requiredKeys: ["id", "title"] }) }), cards: S("array", { required: true, items: S("object", { requiredKeys: ["id", "column"] }) }) }, local: { board: { type: "array|null", default: null } }, events: { move: { payload: { id: "string", from: "string", to: "string", cards: "array" } } }, outputs: ["board"] },
    calendar: { summary: "Month grid with event dots, month navigation and a selected ISO date.", props: { label: S("string", { required: true }), month: S("string", { required: true }), events: S("array", { items: S("object", { properties: { date: S("string"), title: S("string") }, requiredKeys: ["date", "title"] }) }), value: S("string"), weekStart: S("number", { enum: [0, 1], default: 1 }) }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { value: "string" } } }, outputs: ["value"] },
    carousel: { summary: "One slide at a time with previous/next, dots and arrow keys; the slide index is public.", props: { label: S("string", { required: true }), slides: S("array", { required: true, items: S("object") }), index: S("number"), empty: S("string") }, local: { index: { type: "number", default: 0 } }, events: { change: { payload: { index: "number" } } }, outputs: ["index"] },
    markdown: { summary: "Markdown subset (headings, lists, quotes, code, emphasis, links, $math$) rendered as elements, never HTML.", props: { text: S("string", { required: true }) } },
    math: { summary: "TeX math (fractions, roots, scripts and limits, matrices, cases, accents, stretchy delimiters, Greek and symbols) rendered as accessible elements.", props: { tex: S("string", { required: true }), display: S("boolean"), label: S("string") } }
  };
  var APPS_NOTES = {
    "switch": "Use for an immediate on/off setting; change emits {checked}. Use checkbox for form-style choices.",
    combobox: "Use when the option list is long enough to search. options [{value,label}]; change emits {value}. Free text is not accepted.",
    tree: "nodes: [{id,label,children?}] up to depth 8 and 500 nodes. select emits {id}; arrows move, Right/Left expand and collapse.",
    "data-grid": "columns [{key,label}], rows objects. Sorts, filters (filterable) and pages in place; select emits {row,index} and the selected row is the public output.",
    kanban: "columns [{id,title}], cards [{id,title,column,description?}]. Buttons move a card; move emits {id,from,to,cards} and the new board is output `board` (null until moved).",
    calendar: "month is YYYY-MM (required, so the render is deterministic). events [{date:YYYY-MM-DD,title}]. change emits {value}; weekStart 0 or 1.",
    carousel: "slides [{title?,text?,src?,alt?}]; image src follows the image block's passive rules. change emits {index}.",
    markdown: "Subset only: #-### headings, lists, > quotes, ``` code, **bold**, *italic*, `code`, [links](https://…) and $tex$ / $$block$$ math. No raw HTML.",
    math: "TeX math, not LaTeX documents: \\frac \\binom \\sqrt[n]{} ^ _ \\sum_{i}^{n} \\int \\lim, \\left( \\right), \\begin{pmatrix|bmatrix|vmatrix|cases|aligned}…\\end, \\hat \\vec \\overline, \\text{} \\mathbb \\mathcal \\mathbf, Greek and common symbols. display:true stacks limits above and below. Unknown commands render as their name; no macros, no packages."
  };
  Object.assign(freeFlowExports, { CoreSwitch: CoreSwitch, CoreCombobox: CoreCombobox, CoreTree: CoreTree, CoreDataGrid: CoreDataGrid, CoreKanban: CoreKanban, CoreCalendar: CoreCalendar, CoreCarousel: CoreCarousel, CoreMarkdown: CoreMarkdown, CoreMath: CoreMath });
  HANDLER.move = "onMove";
  Object.keys(APPS).forEach(function (name) {
    var I = APPS[name]; I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "switch") DEFAULTS[name] = { change: [{ do: "setLocal", key: "checked", value: { $event: "checked" } }] };
    if (name === "combobox" || name === "calendar") DEFAULTS[name] = { change: [{ do: "setLocal", key: "value", value: { $event: "value" } }] };
    if (name === "tree") DEFAULTS[name] = { select: [{ do: "setLocal", key: "value", value: { $event: "id" } }] };
    if (name === "data-grid") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $event: "row" } }] };
    if (name === "kanban") DEFAULTS[name] = { move: [{ do: "setLocal", key: "board", value: { $event: "cards" } }] };
    if (name === "carousel") DEFAULTS[name] = { change: [{ do: "setLocal", key: "index", value: { $event: "index" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "line-control", "accent", "accent-ink", "danger", "focus"], agent: { use: APPS_NOTES[name] } });
  });
