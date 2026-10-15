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

  /* ---- TeX subset -> React nodes. No HTML path exists, so nothing to escape. ---- */
  var TEX_SYMBOLS = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ", sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Sigma: "Σ", Omega: "Ω", Pi: "Π", cdot: "·", times: "×", pm: "±", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠", ne: "≠", approx: "≈", infty: "∞", sum: "∑", prod: "∏", int: "∫", to: "→", rightarrow: "→", partial: "∂", nabla: "∇", sqrt: "√" };
  function parseTex(src) {
    var i = 0, budget = 2000;
    function group(depth) {
      var out = [], key = 0;
      while (i < src.length && budget-- > 0) {
        var c = src[i];
        if (c === "}") { return out; }
        i++;
        if (c === "{") { out.push(h("span", { key: key++ }, depth < 8 ? group(depth + 1) : null)); if (src[i] === "}") i++; continue; }
        if (c === "^" || c === "_") { var arg = atom(depth); out.push(h(c === "^" ? "sup" : "sub", { key: key++ }, arg)); continue; }
        if (c === "\\") {
          var name = /^[A-Za-z]+/.exec(src.slice(i)); name = name ? name[0] : src[i] || ""; i += name.length || 0;
          // Sizing and spacing commands carry no meaning here; rendering their
          // name as text ("left", "right") is the visible failure to avoid.
          if (name === "left" || name === "right" || name === "quad" || name === "qquad" || name === "displaystyle" || name === "limits") { if ((name === "left" || name === "right") && src[i] === ".") i++; else if (name === "quad" || name === "qquad") out.push(h("span", { key: key++ }, " ")); continue; }
          if (name === "frac") { var a = atom(depth), b = atom(depth); out.push(h("span", { key: key++, className: "kg-math__frac" }, h("span", { className: "kg-math__num" }, a), h("span", { className: "kg-math__den" }, b))); }
          else if (name === "sqrt") { out.push(h("span", { key: key++, className: "kg-math__sqrt" }, "√", h("span", { className: "kg-math__radicand" }, atom(depth)))); }
          else out.push(h("span", { key: key++ }, TEX_SYMBOLS[name] || name));
          continue;
        }
        out.push(h("span", { key: key++ }, c));
      }
      return out;
    }
    function atom(depth) {
      if (src[i] === "{") { i++; var g = depth < 8 ? group(depth + 1) : []; if (src[i] === "}") i++; return g; }
      if (src[i] === "\\") { var m = /^\\[A-Za-z]+/.exec(src.slice(i)); var n = m ? m[0] : src.slice(i, i + 2); i += n.length; return TEX_SYMBOLS[n.slice(1)] || n.slice(1); }
      return i < src.length ? src[i++] : "";
    }
    return group(0);
  }
  function CoreMath(p) {
    var tex = String(p.tex == null ? "" : p.tex).slice(0, 2000);
    return h(p.display ? "div" : "span", { className: "kg-math" + (p.display ? " kg-math--display" : ""), role: "math", "aria-label": p.label || tex }, parseTex(tex));
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
    math: { summary: "TeX subset (fractions, roots, scripts, Greek, operators) rendered as accessible elements.", props: { tex: S("string", { required: true }), display: S("boolean"), label: S("string") } }
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
    math: "TeX subset: \\frac{a}{b}, \\sqrt{x}, ^ and _ with {groups}, Greek letters and common operators. Unknown commands render as their name."
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
