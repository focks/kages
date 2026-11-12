/* A slide deck is one stage showing one slide at a time, so a talk, a pitch or a
 * walkthrough can be authored as data and presented from the page. Slides are
 * data, never markup: every string becomes a React text child, images pass the
 * image block's passive-source rules, and the deck reads no clock. Navigation
 * clamps at both ends (a deck is ordered, unlike the carousel which wraps) and
 * the shown index is a public output. See oracle/deck.feature. */
  var DECK_LAYOUTS = ["title", "section", "content", "split", "quote", "stat"];
  var DECK_MAX_SLIDES = 60, DECK_MAX_ITEMS = 8, DECK_MAX_TEXT = 600;
  function deckText(v) { return typeof v === "string" ? v.slice(0, DECK_MAX_TEXT) : typeof v === "number" && isFinite(v) ? String(v) : ""; }
  function deckSlides(raw) {
    return (Array.isArray(raw) ? raw : []).filter(function (s) { return s && typeof s === "object"; }).slice(0, DECK_MAX_SLIDES).map(function (s) {
      return {
        layout: choice(s.layout, DECK_LAYOUTS, "content"), eyebrow: deckText(s.eyebrow), title: deckText(s.title), text: deckText(s.text),
        items: (Array.isArray(s.items) ? s.items : []).slice(0, DECK_MAX_ITEMS).map(deckText).filter(Boolean),
        quote: deckText(s.quote), cite: deckText(s.cite), value: deckText(s.value), caption: deckText(s.caption),
        src: s.src ? imageSource(s.src) : undefined, badSrc: !!s.src && !imageSource(s.src), alt: deckText(s.alt), notes: deckText(s.notes)
      };
    });
  }
  function deckBody(s) {
    var media = s.src ? h("img", { key: "m", className: "kg-deck__media", src: s.src, alt: s.alt, loading: "lazy", decoding: "async" }) : s.badSrc ? h("div", { key: "m", className: "kg-missing", role: "alert" }, "Image source must be HTTPS, a local path or raster image data.") : null;
    var list = s.items.length ? h("ul", { key: "l", className: "kg-deck__list" }, s.items.map(function (t, i) { return h("li", { key: i }, t); })) : null;
    var text = s.text ? h("p", { key: "t", className: "kg-deck__text" }, s.text) : null;
    if (s.layout === "quote") return [h("blockquote", { key: "q", className: "kg-deck__quote" }, h("p", null, s.quote || s.text)), s.cite ? h("p", { key: "c", className: "kg-deck__cite" }, s.cite) : null];
    if (s.layout === "stat") return [h("p", { key: "v", className: "kg-deck__stat" }, s.value), s.caption || s.text ? h("p", { key: "c", className: "kg-deck__text" }, s.caption || s.text) : null];
    if (s.layout === "split") return [h("div", { key: "t", className: "kg-deck__col" }, text, list), media ? h("div", { key: "m", className: "kg-deck__col" }, media) : null];
    return [text, list, media];
  }
  function CoreDeck(p) {
    var slides = deckSlides(p.slides), uid = R().useId();
    var asked = Math.floor(richNum(p.index, 0)), at = Math.max(0, Math.min(slides.length - 1, asked)), s = slides[at];
    // The public `index` output is the stored value, so a stale or out-of-range one (index:99, or a
    // shorter deck than before) must be corrected there too, not only on screen; a block bound to
    // `index` would otherwise disagree with the slide that is shown. Hooks run before the early return.
    R().useEffect(function () { if (slides.length && typeof p.index === "number" && asked !== at) fire(p.onChange, { index: at }); }, [asked, at, slides.length]);
    if (!slides.length) return h("p", null, p.empty || "No slides");
    function go(i) { var to = Math.max(0, Math.min(slides.length - 1, i)); if (to !== at) fire(p.onChange, { index: to }); }
    var keys = { ArrowRight: at + 1, PageDown: at + 1, " ": at + 1, ArrowLeft: at - 1, PageUp: at - 1, Home: 0, End: slides.length - 1 };
    function onKey(e) { if (e.target && e.target.tagName === "BUTTON" && e.key === " ") return; if (Object.prototype.hasOwnProperty.call(keys, e.key)) { e.preventDefault(); go(keys[e.key]); } }
    var ratio = choice(p.ratio, ["16:9", "4:3"], "16:9");
    return h("section", { className: "kg-deck kg-palette-" + regionPalette(p.palette), "aria-roledescription": "slide deck", "aria-label": p.label, onKeyDown: onKey },
      h("div", { id: uid + "-s", className: "kg-deck__stage kg-deck__stage--" + (ratio === "4:3" ? "four-three" : "wide") + " kg-deck__slide--" + s.layout, tabIndex: 0, role: "group", "aria-roledescription": "slide", "aria-label": "Slide " + (at + 1) + " of " + slides.length, "aria-live": "polite" },
        h("div", { className: "kg-deck__slide" },
          s.eyebrow ? h("p", { className: "kg-deck__eyebrow" }, s.eyebrow) : null,
          s.title ? h("h3", { className: "kg-deck__title" }, s.title) : null,
          deckBody(s))),
      h("div", { className: "kg-deck__bar" },
        // aria-disabled, not disabled: a disabled button drops keyboard focus when the last slide is
        // reached, leaving a keyboard user on nothing. go() already ignores a move past either end.
        h("button", { type: "button", className: "kg-btn", "aria-disabled": at === 0 ? "true" : undefined, "aria-controls": uid + "-s", onClick: function () { go(at - 1); } }, "Previous"),
        h("span", { className: "kg-deck__count", "aria-hidden": "true" }, (at + 1) + " / " + slides.length),
        h("button", { type: "button", className: "kg-btn", "aria-disabled": at === slides.length - 1 ? "true" : undefined, "aria-controls": uid + "-s", onClick: function () { go(at + 1); } }, "Next")),
      h("ol", { className: "kg-deck__rail", "aria-label": "Slides" }, slides.map(function (t, i) {
        return h("li", { key: i }, h("button", { type: "button", className: "kg-deck__thumb" + (i === at ? " kg-deck__thumb--on" : ""), "aria-current": i === at ? "true" : undefined, "aria-label": "Slide " + (i + 1) + (t.title ? ": " + t.title : ""), onClick: function () { go(i); } },
          h("span", { className: "kg-deck__thumb-n" }, i + 1), h("span", { className: "kg-deck__thumb-t" }, t.title || t.quote || t.value || "Untitled")));
      })),
      p.notes && s.notes ? h("aside", { className: "kg-deck__notes", "aria-label": "Speaker notes" }, h("strong", null, "Notes"), h("p", null, s.notes)) : null);
  }
  interfaces["kages/deck@1"] = {
    role: "deck", summary: "Slide deck: one slide at a time on a fixed-ratio stage with keyboard navigation, a slide rail and optional speaker notes; the slide index is public.",
    props: { label: S("string", { required: true }), slides: S("array", { required: true, items: S("object") }), index: S("number"), ratio: S("string", { enum: ["16:9", "4:3"], default: "16:9" }), palette: S("string", { enum: REGION_PALETTES, default: "inherit" }), notes: S("boolean"), empty: S("string") },
    slots: {}, local: { index: { type: "number", default: 0 } }, events: { change: { payload: { index: "number" } } }, outputs: ["index"]
  };
  DEFAULTS.deck = { change: [{ do: "setLocal", key: "index", value: { $event: "index" } }] };
  core.deck = contract("core", "deck", "1.0.0", "kages/deck@1", CoreDeck, {
    tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "line-control", "accent", "accent-ink", "accent-soft", "focus"],
    agent: { use: "A presentation: a talk, pitch or walkthrough shown one slide at a time. slides [{layout?:title|section|content|split|quote|stat, eyebrow?, title?, text?, items?:string[<=8], quote?, cite?, value?, caption?, src?, alt?, notes?}], up to 60. Open with a title slide, give every slide one idea and at most 8 short items, and use split with src+alt when a picture carries the point. ratio 16:9 (default) or 4:3; palette tints the stage; notes:true shows each slide's notes under it. change emits {index}; the shown index is the public output `index`, so a progress label or a link can bind to it. Navigation clamps at both ends. Use carousel for an unordered gallery, guide for chaptered reading." }
  });
  Object.assign(freeFlowExports, { CoreDeck: CoreDeck });
