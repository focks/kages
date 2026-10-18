/* Batch 5a: structure and media — tab panel, code tabs, anchor + table of
 * contents, video, audio and gallery. Media sources follow the passive rules of
 * the image block: https or local paths only, never data:, javascript: or
 * protocol-relative URLs; nothing autoplays. Everything user-visible is text in
 * React children. See oracle/rich-artifacts.feature. */
  function mediaSource(v) { return typeof v === "string" && v.length < 2048 && /^(https:\/\/[^\s<>"'\\]+|\/(?!\/)[^\s<>"'\\]*)$/.test(v) ? v : undefined; }
  function langTag(v) { return typeof v === "string" && /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})?$/.test(v) ? v : undefined; }
  // An anchor name becomes a DOM id, so it is restricted to a safe slug and
  // namespaced; a bare author-chosen id could clobber page elements (DOM clobbering).
  function anchorId(name) { var s = String(name == null ? "" : name).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); return s ? "kg-a-" + s : undefined; }

  function CoreTabPanel(p) {
    var uid = R().useId(), tabs = (Array.isArray(p.tabs) ? p.tabs : []).filter(function (t) { return t && typeof t.id === "string"; }).slice(0, 6);
    if (!tabs.length) return null;
    var at = Math.max(0, tabs.findIndex(function (t) { return t.id === p.value; }));
    function go(i) {
      var n = (i + tabs.length) % tabs.length; fire(p.onChange, { id: tabs[n].id });
      var el = typeof document !== "undefined" && document.getElementById(uid + "-t" + n); if (el && el.focus) el.focus();
    }
    return h("div", { className: "kg-tabpanel" },
      h("div", { role: "tablist", "aria-label": p.label, className: "kg-tabpanel__list", onKeyDown: function (e) {
        if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); }
        else if (e.key === "Home") { e.preventDefault(); go(0); } else if (e.key === "End") { e.preventDefault(); go(tabs.length - 1); }
      } }, tabs.map(function (t, i) { return h("button", { key: t.id, id: uid + "-t" + i, type: "button", role: "tab", className: "kg-tabpanel__tab" + (i === at ? " kg-tabpanel__tab--on" : ""), "aria-selected": i === at, "aria-controls": uid + "-p" + i, tabIndex: i === at ? 0 : -1, onClick: function () { fire(p.onChange, { id: t.id }); } }, String(t.label == null ? t.id : t.label)); })),
      tabs.map(function (t, i) { return h("div", { key: t.id, id: uid + "-p" + i, role: "tabpanel", "aria-labelledby": uid + "-t" + i, hidden: i !== at, tabIndex: 0, className: "kg-tabpanel__panel" }, p["panel" + (i + 1)]); }));
  }

  function CoreCodeTabs(p) {
    var R_ = R(), uid = R_.useId(), st = R_.useState(false), copied = st[0], setCopied = st[1];
    var tabs = (Array.isArray(p.tabs) ? p.tabs : []).filter(function (t) { return t && typeof t.id === "string"; }).slice(0, 8);
    if (!tabs.length) return null;
    var at = Math.max(0, tabs.findIndex(function (t) { return t.id === p.value; })), tab = tabs[at], code = String(tab.code == null ? "" : tab.code).slice(0, 20000);
    function copy() {
      // Clipboard writes need a user gesture and may be refused; failure is silent
      // because the code stays selectable on screen either way.
      try { var w = typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText(code); if (w && w.then) w.then(function () { setCopied(true); setTimeout(function () { setCopied(false); }, 1600); }, function () {}); } catch (e) { /* ignore */ }
    }
    return h("figure", { className: "kg-codetabs" }, p.caption ? h("figcaption", null, p.caption) : null,
      h("div", { className: "kg-codetabs__bar" },
        h("div", { role: "tablist", "aria-label": p.caption || "Code languages", className: "kg-codetabs__list" }, tabs.map(function (t, i) { return h("button", { key: t.id, type: "button", role: "tab", id: uid + "-t" + i, "aria-selected": i === at, "aria-controls": uid + "-p", tabIndex: i === at ? 0 : -1, className: "kg-codetabs__tab" + (i === at ? " kg-codetabs__tab--on" : ""), onClick: function () { fire(p.onChange, { id: t.id }); } }, String(t.label == null ? t.id : t.label)); })),
        h("button", { type: "button", className: "kg-codetabs__copy", onClick: copy }, copied ? "Copied" : "Copy"), h("span", { className: "kg-sr-only", role: "status" }, copied ? "Copied to clipboard" : "")),
      h("pre", { id: uid + "-p", role: "tabpanel", "aria-labelledby": uid + "-t" + at, tabIndex: 0, className: "kg-codetabs__code" }, h("code", { lang: langTag(tab.language) }, code)));
  }

  function CoreAnchor(p) { var id = anchorId(p.name); return id ? h("span", { id: id, className: "kg-anchor", tabIndex: -1 }) : null; }

  function CoreToc(p) {
    var R_ = R(), st = R_.useState(""), seen = st[0], setSeen = st[1];
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && anchorId(it.target); }).slice(0, 40);
    // Highlight the section being read. Observers are a progressive enhancement:
    // without IntersectionObserver (or on the server) the list is still a list of links.
    R_.useEffect(function () {
      if (typeof IntersectionObserver === "undefined" || !items.length) return;
      var els = items.map(function (it) { return document.getElementById(anchorId(it.target)); }).filter(Boolean);
      var io = new IntersectionObserver(function (entries) { entries.forEach(function (en) { if (en.isIntersecting) setSeen(en.target.id); }); }, { rootMargin: "0px 0px -70% 0px" });
      els.forEach(function (el) { io.observe(el); });
      return function () { io.disconnect(); };
    }, [items.map(function (it) { return it.target; }).join("|")]);
    if (!items.length) return null;
    var current = p.value ? anchorId(p.value) : seen;
    return h("nav", { className: "kg-toc" + (p.sticky ? " kg-toc--sticky" : ""), "aria-label": p.title || "On this page" }, p.title ? h("p", { className: "kg-toc__title" }, p.title) : null,
      h("ol", { className: "kg-toc__list" }, items.map(function (it, i) {
        var id = anchorId(it.target);
        return h("li", { key: i, className: "kg-toc__item kg-toc__item--l" + choice(it.level, [1, 2, 3], 1) }, h("a", { href: "#" + id, className: "kg-toc__link" + (current === id ? " kg-toc__link--on" : ""), "aria-current": current === id ? "location" : undefined,
          onClick: function (e) {
            fire(p.onSelect, { target: String(it.target) });
            var el = typeof document !== "undefined" && document.getElementById(id); if (!el) return;
            e.preventDefault();
            var calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
            el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" }); el.focus({ preventScroll: true });
          } }, String(it.label == null ? it.target : it.label)));
      })));
  }

  // Terms and their meanings. A native description list: the pairing is in the
  // markup, not only the layout. Bounded so a hostile document cannot grow it.
  function CoreGlossary(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.term === "string" && it.term; }).slice(0, 200);
    if (!items.length) return null;
    return h("div", { className: "kg-glossary" }, p.title ? h("p", { className: "kg-glossary__title" }, p.title) : null,
      h("dl", { className: "kg-glossary__list" }, items.map(function (it, i) {
        return h("div", { key: i, className: "kg-glossary__item" }, h("dt", null, it.term), h("dd", null, String(it.definition == null ? "" : it.definition)));
      })));
  }

  // The numbered sources a page cites. Each item is a jump target for a
  // `cite` run in rich-text (the id is the same namespaced slug), so a number
  // in the prose lands on its source; the link on the item leaves the page.
  function CoreReferences(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && typeof it.id === "string" && anchorId(it.id) && it.label; }).slice(0, 200);
    if (!items.length) return null;
    return h("div", { className: "kg-references" }, p.title ? h("p", { className: "kg-references__title" }, p.title) : null,
      h("ol", { className: "kg-references__list" }, items.map(function (it, i) {
        var href = passiveLink(it.href);
        return h("li", { key: i, id: anchorId("ref-" + it.id), tabIndex: -1 }, href ? h("a", { href: href, rel: "noopener noreferrer" }, String(it.label)) : String(it.label), it.detail ? h("span", { className: "kg-references__detail" }, " · " + String(it.detail)) : null);
      })));
  }

  function mediaTracks(p) {
    return (Array.isArray(p.captions) ? p.captions : []).slice(0, 8).map(function (c, i) { var src = c && mediaSource(c.src); return src ? h("track", { key: i, kind: "captions", src: src, srcLang: langTag(c.lang), label: String(c.label || c.lang || "Captions") }) : null; });
  }
  function transcript(p) { return p.transcript ? h("details", { className: "kg-media__transcript" }, h("summary", null, "Transcript"), h("p", null, String(p.transcript).slice(0, 20000))) : null; }
  function CoreVideo(p) {
    var src = mediaSource(p.src);
    return h("figure", { className: "kg-media kg-media--video" }, src ? h("video", { controls: true, preload: "metadata", playsInline: true, src: src, poster: p.poster ? imageSource(p.poster) : undefined, "aria-label": p.label }, mediaTracks(p)) : h("div", { className: "kg-missing", role: "alert" }, "Video source must be an https URL or a local path."),
      p.caption ? h("figcaption", null, p.caption) : null, transcript(p));
  }
  function CoreAudio(p) {
    var src = mediaSource(p.src);
    return h("figure", { className: "kg-media kg-media--audio" }, src ? h("audio", { controls: true, preload: "metadata", src: src, "aria-label": p.label }, mediaTracks(p)) : h("div", { className: "kg-missing", role: "alert" }, "Audio source must be an https URL or a local path."),
      p.caption ? h("figcaption", null, p.caption) : null, transcript(p));
  }

  function CoreGallery(p) {
    var R_ = R(), ref = R_.useRef(null), opener = R_.useRef(null);
    var items = (Array.isArray(p.items) ? p.items : []).map(function (it) { return it && { src: imageSource(it.src), alt: String(it.alt == null ? "" : it.alt), caption: it.caption ? String(it.caption) : "" }; }).filter(function (it) { return it && it.src; }).slice(0, 60);
    var at = typeof p.index === "number" && p.index >= 0 && p.index < items.length ? Math.floor(p.index) : -1, open = at >= 0;
    // Focus the dialog on open and return it to the thumbnail that opened it,
    // otherwise keyboard users land back at the top of the page.
    R_.useEffect(function () {
      if (!open || !ref.current) return;
      ref.current.focus();
      return function () { if (opener.current && opener.current.focus) opener.current.focus(); };
    }, [open]);
    if (!items.length) return h("p", null, p.empty || "No images");
    function show(i) { fire(p.onChange, { index: (i + items.length) % items.length }); }
    var cur = open ? items[at] : null;
    return h("div", { className: "kg-gallery" }, h("ul", { className: "kg-gallery__grid", "aria-label": p.label }, items.map(function (it, i) {
      return h("li", { key: i }, h("button", { type: "button", className: "kg-gallery__thumb", "aria-label": "View image " + (i + 1) + " of " + items.length + (it.alt ? ": " + it.alt : ""), onClick: function (e) { opener.current = e.currentTarget; show(i); } }, h("img", { src: it.src, alt: it.alt, loading: "lazy", decoding: "async" })));
    })),
    open ? h("div", { className: "kg-modal kg-gallery__lightbox", onClick: function (e) { if (e.target === e.currentTarget) fire(p.onChange, { index: -1 }); } },
      h("div", { ref: ref, className: "kg-modal__dialog kg-gallery__dialog", role: "dialog", "aria-modal": "true", "aria-label": p.label, tabIndex: -1, onKeyDown: function (e) {
        if (e.key === "Escape") { e.stopPropagation(); fire(p.onChange, { index: -1 }); } else if (e.key === "ArrowRight") { e.preventDefault(); show(at + 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); show(at - 1); }
      } }, h("img", { src: cur.src, alt: cur.alt }), cur.caption ? h("p", { className: "kg-gallery__caption" }, cur.caption) : null,
        h("div", { className: "kg-gallery__bar" }, h("button", { type: "button", className: "kg-btn", onClick: function () { show(at - 1); } }, "Previous"), h("span", { "aria-live": "polite" }, (at + 1) + " / " + items.length), h("button", { type: "button", className: "kg-btn", onClick: function () { show(at + 1); } }, "Next"), h("button", { type: "button", className: "kg-btn", onClick: function () { fire(p.onChange, { index: -1 }); } }, "Close")))) : null);
  }

  var PANEL_SLOTS = {}; [1, 2, 3, 4, 5, 6].forEach(function (n) { PANEL_SLOTS["panel" + n] = {}; });
  var SRC = S("string", { required: true }), MEDIA_EXTRA = { caption: S("string"), transcript: S("string"), captions: S("array", { items: S("object", { properties: { src: S("string"), lang: S("string"), label: S("string") }, requiredKeys: ["src"] }) }) };
  var CONTENT = {
    "tab-panel": { summary: "Tabs whose panels hold blocks: panel1..panel6 map to the tabs in order, and only the selected panel shows.", props: { label: S("string", { required: true }), tabs: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string") }, requiredKeys: ["id", "label"] }) }), value: S("string") }, slots: PANEL_SLOTS, local: { value: { type: "string", default: "" } }, events: { change: { payload: { id: "string" } } }, outputs: ["value"] },
    "code-tabs": { summary: "One code listing in several languages behind tabs, with a copy button; code is displayed, never run.", props: { caption: S("string"), tabs: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string"), language: S("string"), code: S("string") }, requiredKeys: ["id", "label", "code"] }) }), value: S("string") }, local: { value: { type: "string", default: "" } }, events: { change: { payload: { id: "string" } } }, outputs: ["value"] },
    anchor: { summary: "Invisible jump target; place it just before a heading so a table of contents can link to it.", props: { name: S("string", { required: true }) } },
    toc: { summary: "On-this-page outline of links that scroll to anchors, highlighting the section in view.", props: { title: S("string"), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), target: S("string"), level: S("number", { enum: [1, 2, 3] }) }, requiredKeys: ["label", "target"] }) }), sticky: S("boolean"), value: S("string") }, local: { value: { type: "string", default: "" } }, events: { select: { payload: { target: "string" } } }, outputs: ["value"] },
    video: { summary: "Video with native controls, optional poster, captions and transcript; never autoplays.", props: Object.assign({ label: S("string", { required: true }), src: SRC, poster: S("string") }, MEDIA_EXTRA) },
    audio: { summary: "Audio with native controls, optional captions and transcript; never autoplays.", props: Object.assign({ label: S("string", { required: true }), src: SRC }, MEDIA_EXTRA) },
    glossary: { summary: "Terms and their meanings as a description list.", props: { title: S("string"), items: S("array", { required: true, items: S("object", { properties: { term: S("string"), definition: S("string") }, requiredKeys: ["term", "definition"] }) }) } },
    references: { summary: "Numbered sources a page cites; rich-text cite runs link to them by id.", props: { title: S("string"), items: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string"), href: S("string"), detail: S("string") }, requiredKeys: ["id", "label"] }) }) } },
    gallery: { summary: "Grid of thumbnails opening a keyboard-operable lightbox; the open image index is public (-1 = closed).", props: { label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { src: S("string"), alt: S("string"), caption: S("string") }, requiredKeys: ["src", "alt"] }) }), index: S("number"), empty: S("string") }, local: { index: { type: "number", default: -1 } }, events: { change: { payload: { index: "number" } } }, outputs: ["index"] }
  };
  var CONTENT_NOTES = {
    "tab-panel": "tabs: [{id,label}] (max 6); put each tab's blocks in slot panel1, panel2… in the same order. Empty value means the first tab. change emits {id}. Use for alternatives, not for sequence (use stepper).",
    "code-tabs": "tabs: [{id,label,language?,code}]. Use for the same snippet in several languages or shells. Code is literal text; the copy button copies the visible tab.",
    anchor: "name becomes a jump target (letters, digits, - and _). Put one before each heading you want to link to.",
    toc: "items: [{label,target,level?}] where target is an anchor name defined by an `anchor` block on the same page. sticky keeps it in view while scrolling. Every target needs a matching anchor.",
    video: "src is an https URL or local path. Add captions [{src,lang,label}] and a transcript for accessibility. No autoplay, no embeds of third-party players.",
    audio: "src is an https URL or local path. Add a transcript for accessibility. No autoplay.",
    glossary: "items: [{term,definition}] in the order to read them; one sentence per definition. Put it near the end of a long page. Define a term where it is first used too.",
    references: "items: [{id,label,href?,detail?}] in citation order; the list is numbered 1, 2, 3… in that order. In prose, cite with a rich-text run {text:\"1\",cite:\"<id>\"} whose text is the item's position. href is https; detail is the publisher or author. Every cited id must exist here, and every claim from a source should cite it.",
    gallery: "items: [{src,alt,caption?}] with the image block's source rules. Thumbnails open a lightbox; arrows navigate, Escape closes. index -1 means closed."
  };
  Object.assign(freeFlowExports, { CoreTabPanel: CoreTabPanel, CoreCodeTabs: CoreCodeTabs, CoreAnchor: CoreAnchor, CoreToc: CoreToc, CoreVideo: CoreVideo, CoreAudio: CoreAudio, CoreGallery: CoreGallery, CoreGlossary: CoreGlossary, CoreReferences: CoreReferences });
  Object.keys(CONTENT).forEach(function (name) {
    var I = CONTENT[name]; I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "tab-panel" || name === "code-tabs") DEFAULTS[name] = { change: [{ do: "setLocal", key: "value", value: { $event: "id" } }] };
    if (name === "toc") DEFAULTS[name] = { select: [{ do: "setLocal", key: "value", value: { $event: "target" } }] };
    if (name === "gallery") DEFAULTS[name] = { change: [{ do: "setLocal", key: "index", value: { $event: "index" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "accent-ink", "focus"], agent: { use: CONTENT_NOTES[name] } });
  });
