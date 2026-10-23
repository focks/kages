/* Field guides are chaptered documents, not application consoles. Navigation
 * stays in this trusted component; chapters and evidence remain ordinary blocks
 * and state. Nothing in the document supplies HTML, CSS or executable routes. */
  function guideChapters(value) {
    var seen = Object.create(null);
    return (Array.isArray(value) ? value : []).filter(function (c) {
      if (!c || typeof c.id !== "string" || !/^[a-z][a-z0-9-]{0,47}$/.test(c.id) || seen[c.id]) return false;
      seen[c.id] = true; return true;
    }).slice(0, 40);
  }
  function CoreGuide(p) {
    var R_ = R(), uid = R_.useId(), main = R_.useRef(null), menu = R_.useRef(null);
    var mobile = R_.useState(false), open = mobile[0], setOpen = mobile[1];
    var theme = R_.useState(false), dark = theme[0], setDark = theme[1];
    var chapters = guideChapters(p.chapters), at = Math.max(0, chapters.findIndex(function (c) { return c.id === p.value; }));
    var active = chapters[at], previous = R_.useRef(p.value), latest = R_.useRef(p); latest.current = p;
    R_.useEffect(function () {
      // Appearance belongs to this opaque artifact frame, not the dashboard.
      function sync() { setDark(document.documentElement.classList.contains("dark")); }
      sync(); var observer = new MutationObserver(sync);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      return function () { observer.disconnect(); };
    }, []);
    function select(id, route) {
      if (!chapters.some(function (c) { return c.id === id; })) return;
      fire(latest.current.onChange, { id: id }); setOpen(false);
      if (route && typeof window !== "undefined") window.dispatchEvent(new CustomEvent("kages-navigate", { detail: { chapter: id } }));
    }
    R_.useEffect(function () {
      function route(e) { var id = e ? e.detail.chapter : document.documentElement.dataset.kagesChapter; if (id) select(id, false); }
      route(); window.addEventListener("kages-location", route);
      return function () { window.removeEventListener("kages-location", route); };
    }, [chapters.map(function (c) { return c.id; }).join("|")]);
    R_.useEffect(function () {
      if (previous.current === p.value) return;
      previous.current = p.value;
      // A chapter is a new reading position. Focus follows it, but ordinary
      // input changes within the chapter must not reset the reader's scroll.
      if (main.current) { main.current.scrollIntoView({ block: "start", behavior: "instant" }); main.current.focus({ preventScroll: true }); }
    }, [p.value]);
    function link(c, label, className) { return h("a", { href: "#" + c.id, className: className, onClick: function (e) { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); select(c.id, true); } } }, label); }
    return h("div", { className: "kg-guide", onKeyDown: function (e) { if (e.key === "Escape" && open) { e.stopPropagation(); setOpen(false); if (menu.current) menu.current.focus(); } } },
      h("a", { href: "#" + uid + "-main", className: "kg-guide__skip", onClick: function (e) { e.preventDefault(); if (main.current) main.current.focus(); } }, "Skip to chapter"),
      h("aside", { className: "kg-guide__rail kg-palette-" + regionPalette(p.palette) },
        h("div", { className: "kg-guide__brand" }, p.mark ? h("span", { className: "kg-guide__mark", "aria-hidden": "true" }, String(p.mark).slice(0, 4)) : null,
          h("div", null, h("strong", null, p.title), p.description ? h("p", null, p.description) : null)),
        h("button", { ref: menu, type: "button", className: "kg-guide__menu", "aria-expanded": open, "aria-controls": uid + "-nav", onClick: function () { setOpen(!open); } }, open ? "Close chapters" : "Chapters"),
        h("nav", { id: uid + "-nav", "aria-label": p.label || "Guide chapters", className: "kg-guide__nav" + (open ? " kg-guide__nav--open" : "") }, chapters.map(function (c, i) {
          return h("a", { key: c.id, href: "#" + c.id, "aria-current": i === at ? "page" : undefined, onClick: function (e) { if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) { e.preventDefault(); select(c.id, true); } } }, h("span", { "aria-hidden": "true" }, String(i + 1).padStart(2, "0")), String(c.label || c.id));
        })), p.note ? h("p", { className: "kg-guide__note" }, p.note) : null),
      h("div", { className: "kg-guide__body" },
        h("header", { className: "kg-guide__bar" }, h("span", null, p.eyebrow || "Field guide", active ? " / " + String(active.label || active.id) : ""), h("div", { className: "kg-guide__actions" }, p.themeToggle !== false ? h("button", { type: "button", className: "kg-guide__theme", "aria-label": dark ? "Switch to light theme" : "Switch to dark theme", onClick: function () { document.documentElement.classList.toggle("dark", !dark); } }, dark ? "Light theme" : "Dark theme") : null, p.actions)),
        h("main", { ref: main, id: uid + "-main", tabIndex: -1, className: "kg-guide__main", "aria-label": active ? String(active.label || active.id) : p.title }, p.children,
          h("nav", { className: "kg-guide__pagination", "aria-label": "Chapter navigation" }, at > 0 ? link(chapters[at - 1], h("span", null, h("small", null, "Previous chapter"), "← " + chapters[at - 1].label)) : h("span", null), at < chapters.length - 1 ? link(chapters[at + 1], h("span", null, h("small", null, "Next chapter"), chapters[at + 1].label + " →")) : null)),
        p.footer && p.footer.length ? h("footer", { className: "kg-guide__footer" }, p.footer) : null));
  }

  function CoreDisclosure(p) {
    var R_ = R(), state = R_.useState(!!p.open), open = typeof p.open === "boolean" ? p.open : state[0];
    return h("details", { className: "kg-disclosure kg-palette-" + regionPalette(p.palette), open: open, onToggle: function (e) {
      var next = e.currentTarget.open;
      if (next === open) return;
      state[1](next); fire(p.onChange, { open: next });
    } }, h("summary", null, p.eyebrow ? h("small", null, p.eyebrow) : null, h("span", { className: "kg-disclosure__title" }, p.title), p.badge ? h("span", { className: "kg-disclosure__badge" }, p.badge) : null),
      h("div", { className: "kg-disclosure__body" }, p.children));
  }
  var GUIDES = {
    guide: { summary: "Editorial field guide with chapter navigation, responsive menu, reading canvas and previous/next links. Compose each chapter from ordinary blocks.", props: {
      title: S("string", { required: true }), description: S("string"), mark: S("string"), eyebrow: S("string"), note: S("string"), label: S("string"), themeToggle: S("boolean", { default: true }), palette: S("string", { enum: REGION_PALETTES, default: "mint" }),
      chapters: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string") }, requiredKeys: ["id", "label"] }) }), value: S("string")
    }, slots: { children: {}, actions: {}, footer: {} }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { id: "string" } } }, outputs: ["value"] },
    disclosure: { summary: "Expandable evidence or troubleshooting entry containing real blocks, including citations, code and actions.", props: {
      title: S("string", { required: true }), eyebrow: S("string"), badge: S("string"), palette: S("string", { enum: REGION_PALETTES, default: "inherit" }), open: S("boolean")
    }, slots: { children: {} }, local: { open: { type: "boolean", default: false } }, events: { change: { payload: { open: "boolean" } } }, outputs: ["open"] }
  };
  Object.assign(freeFlowExports, { CoreGuide: CoreGuide, CoreDisclosure: CoreDisclosure });
  Object.keys(GUIDES).forEach(function (name) {
    var I = GUIDES[name]; I.role = name; interfaces["kages/" + name + "@1"] = I;
    DEFAULTS[name] = { change: [{ do: "setLocal", key: name === "guide" ? "value" : "open", value: { $event: name === "guide" ? "id" : "open" } }] };
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", name === "guide" ? CoreGuide : CoreDisclosure, {
      tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "accent-soft", "accent-ink", "focus"],
      agent: { use: name === "guide" ? "Use as root for a field guide/handbook. chapters [{id,label}] has at most 40 unique lowercase slug ids. Initialize state.chapter to the first id, bind value to it and set chapter from change {id}. Put chapter sections in children with visible:$eq(state.chapter,id). Native host chapter links/history work in full preview and shared views; embedded copies keep local navigation. Add actions and footer slots. The rail follows scrolling in fill frames, collapses to a Chapters button in narrow containers, and preserves in-chapter state. Use heading level 1 for each chapter opening. One guide per artifact." : "Put rich detail in children: paragraphs, citations, code, links. title is the summary; eyebrow is category, badge is evidence status. Repeat a disclosure over a filtered dataset for searchable caveats or sources, with a stable repeat key. open is public; change emits {open}. Default behavior toggles without wiring. Native details gives keyboard access. Do not hide the only explanation of a critical risk." }
    });
  });
