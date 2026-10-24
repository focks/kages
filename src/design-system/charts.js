/* Batch 4: richer data visualisation — combo, stacked bar, funnel, treemap,
 * Sankey and map. Same rules as rich.js: numbers are sanitised and bounded
 * before they become geometry, colours are token paints from a fixed list, data
 * text only ever reaches React children or <title>, and every chart renders its
 * values as a table so nothing is visual-only. See oracle/rich-artifacts.feature. */
  // Clamped, not rejected: an astronomically large value must still be a finite
  // number or the nice-axis maths overflows to Infinity and every gridline with it.
  function chartNum(n) { return typeof n === "number" && isFinite(n) ? Math.max(-1e12, Math.min(1e12, n)) : null; }
  // Series beyond the palette reuse colours at reduced opacity so six or more
  // series stay distinguishable instead of silently repeating.
  function seriesOpacity(i) { return i < SERIES.length ? 1 : i < SERIES.length * 2 ? .65 : .4; }
  /** A tidy axis maximum: 1, 2, 2.5, 5 or 10 times a power of ten. */
  function niceCeil(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log(v) / Math.LN10)), f = v / p;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
  }
  function shortLabel(s, n) { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function toggleLabel(p, label, extra) { fire(p.onSelect, Object.assign({ label: String(label) }, extra)); }
  function legend(names, p) {
    return h("ul", { className: "kg-legend kg-legend--row" }, names.map(function (n, i) { return h("li", { key: i }, h("span", { className: "kg-legend__swatch", style: { background: dataPaint(p, i, n), opacity: seriesOpacity(i) } }), String(n)); }));
  }
  /** Shared Cartesian frame: gridlines with value labels, category labels, and a
   *  mapper from data value to y. Bounds are fixed (640x320 viewBox) so the SVG
   *  scales with its container. */
  function frame(lo, hi, categories, ticks) {
    var top = 16, bottom = 270, left = 52, right = 628, span = hi - lo || 1;
    function y(v) { return r2(bottom - (v - lo) / span * (bottom - top)); }
    var parts = [];
    for (var t = 0; t <= ticks; t++) {
      var v = lo + span * t / ticks, yy = y(v);
      parts.push(h("line", { key: "g" + t, x1: left, y1: yy, x2: right, y2: yy, stroke: "var(--kg-line)", strokeWidth: 1 }));
      parts.push(h("text", { key: "t" + t, x: left - 6, y: yy + 4, textAnchor: "end", fill: "var(--kg-ink-muted)", fontSize: 11 }, String(r2(v))));
    }
    var n = categories.length, band = (right - left) / Math.max(1, n);
    categories.forEach(function (c, i) { parts.push(h("text", { key: "c" + i, x: r2(left + band * (i + .5)), y: 290, textAnchor: "middle", fill: "var(--kg-ink-muted)", fontSize: 11 }, shortLabel(c, Math.max(4, Math.floor(band / 6.5))))); });
    return { y: y, left: left, band: band, bottom: bottom, parts: parts, zero: y(Math.max(lo, Math.min(hi, 0))) };
  }
  function cleanSeries(p, kinds) {
    var categories = (Array.isArray(p.categories) ? p.categories : []).slice(0, 60).map(function (c) { return String(c == null ? "" : c); });
    var series = (Array.isArray(p.series) ? p.series : []).filter(function (s) { return s && Array.isArray(s.values); }).slice(0, 12).map(function (s) {
      return { name: String(s.name == null ? "" : s.name), kind: kinds && s.kind === "line" ? "line" : "bar", values: categories.map(function (_, i) { return chartNum(s.values[i]); }) };
    });
    return { categories: categories, series: series };
  }
  function seriesTable(p, d) {
    return dataTable(p.label, [p.xLabel || "Category"].concat(d.series.map(function (s) { return s.name; })), d.categories.map(function (c, i) { return [c].concat(d.series.map(function (s) { return s.values[i] == null ? "–" : s.values[i]; })); }));
  }

  function CoreComboChart(p) {
    var d = cleanSeries(p, true); if (!d.categories.length || !d.series.length) return emptyChart(p);
    var all = []; d.series.forEach(function (s) { s.values.forEach(function (v) { if (v != null) all.push(v); }); });
    var lo = Math.min(0, all.length ? Math.min.apply(null, all) : 0), hi = niceCeil(Math.max(0, all.length ? Math.max.apply(null, all) : 1)), f = frame(lo < 0 ? -niceCeil(-lo) : 0, hi, d.categories, 4);
    var bars = d.series.filter(function (s) { return s.kind === "bar"; }), shapes = f.parts.slice();
    d.series.forEach(function (s, si) {
      var paint = dataPaint(p, si, s.name), op = seriesOpacity(si);
      if (s.kind === "bar") {
        var bi = bars.indexOf(s), w = Math.max(2, f.band * .7 / bars.length);
        s.values.forEach(function (v, i) { if (v == null) return; var x = f.left + f.band * i + f.band * .15 + w * bi, y = f.y(v); shapes.push(h("rect", { key: "b" + si + "-" + i, x: r2(x), y: r2(Math.min(y, f.zero)), width: r2(w - 1), height: r2(Math.abs(f.zero - y)), fill: paint, opacity: op }, h("title", null, s.name + " · " + d.categories[i] + ": " + v))); });
      } else {
        var pts = [], run = [];
        s.values.forEach(function (v, i) { if (v == null) { if (run.length) pts.push(run); run = []; return; } run.push({ x: r2(f.left + f.band * (i + .5)), y: f.y(v), v: v, i: i }); });
        if (run.length) pts.push(run);
        pts.forEach(function (seg, k) {
          shapes.push(h("path", { key: "l" + si + "-" + k, d: seg.map(function (q, j) { return (j ? "L" : "M") + q.x + " " + q.y; }).join(" "), fill: "none", stroke: paint, strokeWidth: 3, opacity: op }));
          seg.forEach(function (q) { shapes.push(h("circle", { key: "p" + si + "-" + q.i, cx: q.x, cy: q.y, r: 4, fill: paint, opacity: op }, h("title", null, s.name + " · " + d.categories[q.i] + ": " + q.v))); });
        });
      }
    });
    shapes.push(h("line", { key: "zero", x1: f.left, y1: f.zero, x2: 628, y2: f.zero, stroke: "var(--kg-ink-muted)" }));
    return h("figure", { className: "kg-scene kg-scene--wide kg-combo" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(640), viewBox: "0 0 640 300", role: "img", "aria-label": p.label }, h("title", null, p.label), shapes), legend(d.series.map(function (s) { return s.name; }), p), seriesTable(p, d));
  }

  function CoreStackedBarChart(p) {
    var d = cleanSeries(p, false); if (!d.categories.length || !d.series.length) return emptyChart(p);
    // Stacks hold magnitudes: a negative or missing value contributes nothing
    // rather than drawing a bar that runs backwards through the stack.
    var totals = d.categories.map(function (_, i) { return d.series.reduce(function (s, x) { return s + Math.max(0, x.values[i] || 0); }, 0); });
    var pct = !!p.percent, hi = pct ? 100 : niceCeil(Math.max.apply(null, totals.concat([0]))), f = frame(0, hi, d.categories, 4), shapes = f.parts.slice();
    d.categories.forEach(function (c, i) {
      var acc = 0, w = f.band * .7;
      d.series.forEach(function (s, si) {
        var raw = Math.max(0, s.values[i] || 0), v = pct ? (totals[i] ? raw / totals[i] * 100 : 0) : raw; if (!v) return;
        var y1 = f.y(acc), y2 = f.y(acc + v); acc += v;
        shapes.push(h("rect", { key: i + "-" + si, x: r2(f.left + f.band * i + f.band * .15), y: r2(y2), width: r2(w), height: r2(Math.max(0, y1 - y2)), fill: dataPaint(p, si, s.name), opacity: seriesOpacity(si), stroke: "var(--kg-paper)", strokeWidth: 1 }, h("title", null, s.name + " · " + c + ": " + raw)));
      });
    });
    return h("figure", { className: "kg-scene kg-scene--wide kg-stacked" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(640), viewBox: "0 0 640 300", role: "img", "aria-label": p.label }, h("title", null, p.label), shapes), legend(d.series.map(function (s) { return s.name; }), p), seriesTable(p, d));
  }

  /** Selectable shape props shared by funnel, treemap and map: a button that
   *  reports its label, with a pressed state and a dimmed unselected look. */
  function pickable(p, key, label, payload, chosen) {
    var a = { key: key, "aria-pressed": chosen, opacity: p.selected && !chosen ? .45 : 1 };
    if (p.interactive) {
      var go = function () { fire(p.onSelect, payload); };
      a.role = "button"; a.tabIndex = 0; a["aria-label"] = label; a.onClick = go;
      a.onKeyDown = function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    } else delete a["aria-pressed"];
    return a;
  }

  function CoreFunnelChart(p) {
    var stages = (Array.isArray(p.stages) ? p.stages : []).filter(function (s) { return s && chartNum(s.value) != null && s.value >= 0; }).slice(0, 12).map(function (s) { return { label: s.label, value: chartNum(s.value) }; });
    var first = stages.length ? stages[0].value : 0; if (!stages.length || first <= 0) return emptyChart(p);
    var rowH = 52, W = 640, shapes = stages.map(function (s, i) {
      var w1 = Math.min(1, s.value / first) * 560, nxt = stages[i + 1] ? Math.min(1, stages[i + 1].value / first) * 560 : w1 * .8, y = i * rowH + 4, cx = W / 2;
      var d = "M" + r2(cx - w1 / 2) + " " + y + "L" + r2(cx + w1 / 2) + " " + y + "L" + r2(cx + nxt / 2) + " " + (y + rowH - 6) + "L" + r2(cx - nxt / 2) + " " + (y + rowH - 6) + "Z";
      var chosen = p.selected === s.label, a = pickable(p, i, s.label + ": " + s.value, { label: String(s.label), value: s.value, index: i }, chosen);
      a.d = d; a.fill = dataPaint(p, 0, ""); a.fillOpacity = Math.max(.25, 1 - i * .12) * (a.opacity); a.stroke = chosen ? "var(--kg-ink)" : "var(--kg-paper)"; a.strokeWidth = chosen ? 3 : 1; delete a.opacity;
      var share = Math.round(s.value / first * 100);
      return h("g", { key: i }, h("path", a, h("title", null, s.label + ": " + s.value + " (" + share + "%)")), h("text", { x: cx, y: y + (rowH - 6) / 2 + 5, textAnchor: "middle", fill: "var(--kg-ink)", fontSize: 14, pointerEvents: "none" }, shortLabel(s.label, 28) + " · " + s.value + " (" + share + "%)"));
    });
    return h("figure", { className: "kg-scene kg-scene--wide kg-funnel" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(640), viewBox: "0 0 640 " + (stages.length * rowH + 8), role: "img", "aria-label": p.label }, h("title", null, p.label), shapes),
      dataTable(p.label, ["Stage", "Value", "Of first"], stages.map(function (s) { return [s.label, s.value, Math.round(s.value / first * 100) + "%"]; })));
  }

  /** Squarified treemap: place items largest-first along the shorter side, keeping
   *  each row's aspect ratios as close to square as possible. */
  function squarify(items, x, y, w, h_) {
    var total = items.reduce(function (s, it) { return s + it.value; }, 0), out = [], rest = items.slice(), scale = (w * h_) / total;
    function worst(row, side) { var s = row.reduce(function (a, it) { return a + it.value * scale; }, 0), mx = Math.max.apply(null, row.map(function (it) { return it.value * scale; })), mn = Math.min.apply(null, row.map(function (it) { return it.value * scale; })); return Math.max(side * side * mx / (s * s), s * s / (side * side * mn)); }
    while (rest.length) {
      var side = Math.min(w, h_), row = [rest.shift()];
      while (rest.length && worst(row.concat([rest[0]]), side) <= worst(row, side)) row.push(rest.shift());
      var area = row.reduce(function (a, it) { return a + it.value * scale; }, 0), thick = area / side, off = 0;
      row.forEach(function (it) {
        var len = it.value * scale / thick;
        out.push(w >= h_ ? { it: it, x: x, y: y + off, w: thick, h: len } : { it: it, x: x + off, y: y, w: len, h: thick });
        off += len;
      });
      if (w >= h_) { x += thick; w -= thick; } else { y += thick; h_ -= thick; }
    }
    return out;
  }
  function CoreTreemap(p) {
    var items = (Array.isArray(p.items) ? p.items : []).filter(function (it) { return it && chartNum(it.value) != null && it.value > 0; }).slice(0, 80).map(function (it) { return { label: it.label, value: chartNum(it.value) }; }).sort(function (a, b) { return b.value - a.value; });
    if (!items.length) return emptyChart(p);
    var total = items.reduce(function (s, it) { return s + it.value; }, 0), rects = squarify(items, 0, 0, 640, 360);
    var shapes = rects.map(function (r, i) {
      var it = r.it, chosen = p.selected === it.label, a = pickable(p, i, it.label + ": " + it.value, { label: String(it.label), value: it.value, index: i }, chosen);
      var big = r.w > 70 && r.h > 34;
      return h("g", { key: i }, h("rect", Object.assign(a, { x: r2(r.x + 1), y: r2(r.y + 1), width: r2(Math.max(0, r.w - 2)), height: r2(Math.max(0, r.h - 2)), rx: 4, fill: dataPaint(p, i, it.label), fillOpacity: .55 * (a.opacity), stroke: chosen ? "var(--kg-ink)" : "var(--kg-paper)", strokeWidth: chosen ? 3 : 1, opacity: undefined }), h("title", null, it.label + ": " + it.value + " (" + Math.round(it.value / total * 100) + "%)")),
        big ? h("text", { x: r2(r.x + 8), y: r2(r.y + 20), fill: "var(--kg-ink)", fontSize: 13, pointerEvents: "none" }, shortLabel(it.label, Math.floor(r.w / 7.5))) : null,
        big ? h("text", { x: r2(r.x + 8), y: r2(r.y + 36), fill: "var(--kg-ink-muted)", fontSize: 12, pointerEvents: "none" }, String(it.value)) : null);
    });
    return h("figure", { className: "kg-scene kg-scene--wide kg-treemap" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(640), viewBox: "0 0 640 360", role: "img", "aria-label": p.label }, h("title", null, p.label), shapes),
      dataTable(p.label, ["Label", "Value", "Share"], items.map(function (it) { return [it.label, it.value, Math.round(it.value / total * 100) + "%"]; })));
  }

  function CoreSankey(p) {
    var nodes = (Array.isArray(p.nodes) ? p.nodes : []).filter(function (n) { return n && typeof n.id === "string"; }).slice(0, 60), byId = Object.create(null);
    nodes.forEach(function (n) { byId[n.id] = { id: n.id, label: String(n.label == null ? n.id : n.label), layer: 0, in: 0, out: 0 }; });
    var links = (Array.isArray(p.links) ? p.links : []).filter(function (l) { return l && byId[l.from] && byId[l.to] && l.from !== l.to && chartNum(l.value) != null && l.value > 0; }).slice(0, 300).map(function (l) { return { from: l.from, to: l.to, value: chartNum(l.value) }; });
    if (!links.length) return emptyChart(p);
    // Longest-path layering by repeated relaxation, bounded by the node count so
    // a cycle cannot loop forever; links that do not point forward are dropped.
    for (var pass = 0; pass < nodes.length; pass++) { var moved = false; links.forEach(function (l) { if (byId[l.to].layer < byId[l.from].layer + 1 && byId[l.from].layer < nodes.length) { byId[l.to].layer = byId[l.from].layer + 1; moved = true; } }); if (!moved) break; }
    links = links.filter(function (l) { return byId[l.from].layer < byId[l.to].layer; });
    if (!links.length) return emptyChart(p);
    links.forEach(function (l) { byId[l.from].out += l.value; byId[l.to].in += l.value; });
    var used = nodes.filter(function (n) { return byId[n.id].in || byId[n.id].out; }).map(function (n) { return byId[n.id]; });
    var layers = []; used.forEach(function (n) { (layers[n.layer] = layers[n.layer] || []).push(n); });
    layers = layers.filter(Boolean); layers.forEach(function (col, ci) { col.forEach(function (n) { n.layer = ci; }); });
    var cols = layers.length, H = 340, gap = 12, colW = 14, W = 640, labelPad = 120;
    // One shared scale for every column, sized so the fullest column (flows plus
    // its gaps) exactly fills the height; otherwise columns would disagree on what
    // a unit of flow looks like and link widths would mislead.
    var scale = Infinity;
    layers.forEach(function (col) { if (!col) return; var sum = col.reduce(function (t, n) { return t + Math.max(n.in, n.out); }, 0); scale = Math.min(scale, (H - 20 - gap * (col.length - 1)) / sum); });
    scale = Math.max(.0001, scale);
    layers.forEach(function (col, ci) {
      var y = 10; col.forEach(function (n) { n.h = Math.max(4, Math.max(n.in, n.out) * scale); n.y = y; n.x = r2(labelPad / 2 + (cols > 1 ? ci * (W - labelPad - colW) / (cols - 1) : 0)); n.oy = 0; n.iy = 0; y += n.h + gap; });
    });
    var sorted = links.slice().sort(function (a, b) { return byId[a.to].y - byId[b.to].y || byId[a.from].y - byId[b.from].y; });
    var paths = sorted.map(function (l, i) {
      var a = byId[l.from], b = byId[l.to], w = Math.max(1, l.value * scale), y1 = a.y + a.oy + w / 2, y2 = b.y + b.iy + w / 2; a.oy += w; b.iy += w;
      var x1 = a.x + colW, x2 = b.x, mx = (x1 + x2) / 2;
      return h("path", { key: i, d: "M" + r2(x1) + " " + r2(y1) + "C" + r2(mx) + " " + r2(y1) + " " + r2(mx) + " " + r2(y2) + " " + r2(x2) + " " + r2(y2), fill: "none", stroke: dataPaint(p, used.indexOf(a), a.id), strokeOpacity: .35, strokeWidth: r2(w) }, h("title", null, a.label + " → " + b.label + ": " + l.value));
    });
    var boxes = used.map(function (n, i) { var left = n.layer === 0; return h("g", { key: "n" + i }, h("rect", { x: n.x, y: r2(n.y), width: colW, height: r2(n.h), fill: dataPaint(p, i, n.id), rx: 2 }, h("title", null, n.label + ": " + Math.max(n.in, n.out))), h("text", { x: left ? r2(n.x + colW + 6) : r2(n.x - 6), y: r2(n.y + n.h / 2 + 4), textAnchor: left ? "start" : "end", fill: "var(--kg-ink)", fontSize: 12 }, shortLabel(n.label, 18))); });
    return h("figure", { className: "kg-scene kg-scene--wide kg-sankey" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(640), viewBox: "0 0 640 360", role: "img", "aria-label": p.label }, h("title", null, p.label), paths, boxes),
      dataTable(p.label, ["From", "To", "Value"], links.map(function (l) { return [byId[l.from].label, byId[l.to].label, l.value]; })));
  }

  /** Flatten GeoJSON Polygon / MultiPolygon coordinates to rings of finite,
   *  range-clamped [lon, lat] points; everything else is ignored. */
  function geoRings(geometry, budget) {
    var rings = [];
    function ring(r) { if (!Array.isArray(r)) return; var pts = []; r.forEach(function (pt) { if (budget.n-- > 0 && Array.isArray(pt) && chartNum(pt[0]) != null && chartNum(pt[1]) != null) pts.push([Math.max(-180, Math.min(180, pt[0])), Math.max(-90, Math.min(90, pt[1]))]); }); if (pts.length > 2) rings.push(pts); }
    if (geometry && geometry.type === "Polygon" && Array.isArray(geometry.coordinates)) geometry.coordinates.forEach(ring);
    else if (geometry && geometry.type === "MultiPolygon" && Array.isArray(geometry.coordinates)) geometry.coordinates.forEach(function (poly) { if (Array.isArray(poly)) poly.forEach(ring); });
    return rings;
  }
  function CoreMap(p) {
    var budget = { n: 20000 };
    var features = (Array.isArray(p.features) ? p.features : []).filter(function (f) { return f && typeof f.id === "string"; }).slice(0, 300).map(function (f) { return { id: f.id, name: String(f.name == null ? f.id : f.name), value: chartNum(f.value), rings: geoRings(f.geometry, budget) }; }).filter(function (f) { return f.rings.length; });
    if (!features.length) return emptyChart(p);
    var minX = 181, maxX = -181, minY = 91, maxY = -91;
    features.forEach(function (f) { f.rings.forEach(function (r) { r.forEach(function (pt) { minX = Math.min(minX, pt[0]); maxX = Math.max(maxX, pt[0]); minY = Math.min(minY, pt[1]); maxY = Math.max(maxY, pt[1]); }); }); });
    // Equirectangular with longitude shrunk by cos(mid-latitude): a cheap local
    // correction that keeps regional maps from looking stretched.
    var kx = Math.max(.2, Math.cos((minY + maxY) / 2 * Math.PI / 180)), gw = Math.max(.0001, (maxX - minX) * kx), gh = Math.max(.0001, maxY - minY);
    var W = 640, scale = Math.min(W / gw, 360 / gh), Hh = Math.max(40, Math.round(gh * scale)), ox = (W - gw * scale) / 2;
    var vals = features.filter(function (f) { return f.value != null; }).map(function (f) { return f.value; }), lo = vals.length ? Math.min.apply(null, vals) : 0, hi = vals.length ? Math.max.apply(null, vals) : 1, sc = Math.max(Math.abs(lo), Math.abs(hi), 1), span = hi / sc - lo / sc;
    var shapes = features.map(function (f, i) {
      var d = f.rings.map(function (r) { return r.map(function (pt, j) { return (j ? "L" : "M") + r2(ox + (pt[0] - minX) * kx * scale) + " " + r2((maxY - pt[1]) * scale); }).join("") + "Z"; }).join("");
      var chosen = p.selected === f.id, a = pickable(p, i, f.name + (f.value != null ? ": " + f.value : ""), { id: f.id, name: f.name, value: f.value }, chosen);
      var shade = f.value == null ? "var(--kg-sunken)" : "color-mix(in srgb, var(--kg-accent) " + Math.round(15 + (span ? (f.value / sc - lo / sc) / span : .5) * 75) + "%, var(--kg-paper))";
      // Name a region only when its bounding box can hold the text, at the box
      // centre; tiny regions stay unlabelled (their name is in the title and table).
      var fx = Infinity, fX = -Infinity, fy = Infinity, fY = -Infinity;
      f.rings.forEach(function (r) { r.forEach(function (pt) { fx = Math.min(fx, pt[0]); fX = Math.max(fX, pt[0]); fy = Math.min(fy, pt[1]); fY = Math.max(fY, pt[1]); }); });
      var bw = (fX - fx) * kx * scale, bh = (fY - fy) * scale;
      return h("g", { key: i }, h("path", Object.assign(a, { key: undefined, d: d, fillRule: "evenodd", style: { fill: shade }, stroke: chosen ? "var(--kg-ink)" : "var(--kg-ink-muted)", strokeWidth: chosen ? 2.5 : .75, strokeLinejoin: "round" }), h("title", null, f.name + (f.value != null ? ": " + f.value : ""))),
        bw > f.name.length * 7 + 12 && bh > 22 ? h("text", { x: r2(ox + ((fx + fX) / 2 - minX) * kx * scale), y: r2((maxY - (fy + fY) / 2) * scale + 4), textAnchor: "middle", fill: "var(--kg-ink)", fontSize: 13, pointerEvents: "none" }, shortLabel(f.name, 20)) : null);
    });
    return h("figure", { className: "kg-scene kg-scene--wide kg-map" }, h("figcaption", null, p.label), h("svg", { style: wideStyle(W), viewBox: "0 0 " + W + " " + Hh, role: "img", "aria-label": p.label }, h("title", null, p.label), shapes),
      dataTable(p.label, ["Region", "Value"], features.map(function (f) { return [f.name, f.value == null ? "–" : f.value]; })));
  }

  var CAT_SERIES = { categories: S("array", { required: true, items: S("string") }), series: S("array", { required: true, items: S("object", { requiredKeys: ["name", "values"] }) }), xLabel: S("string"), empty: S("string") };
  function selectable(extra) { return Object.assign({ interactive: S("boolean"), selected: S("string") }, extra); }
  var CHARTS = {
    "combo-chart": { summary: "Grouped bars and lines on one shared axis for categories, with a legend and data table.", props: Object.assign({ label: S("string", { required: true }) }, CAT_SERIES) },
    "stacked-bar-chart": { summary: "Stacked columns of series per category, absolute or normalised to 100%.", props: Object.assign({ label: S("string", { required: true }), percent: S("boolean") }, CAT_SERIES) },
    "funnel-chart": { summary: "Ordered stages narrowing by value, with the share of the first stage; stages can be selected.", props: selectable({ label: S("string", { required: true }), stages: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number") }, requiredKeys: ["label", "value"] }) }), empty: S("string") }), local: { selected: { type: "string", default: "" } }, events: { select: { payload: { label: "string", value: "number", index: "number" } } }, outputs: ["selected"] },
    treemap: { summary: "Rectangles sized by value, packed to near-square, with optional selection.", props: selectable({ label: S("string", { required: true }), items: S("array", { required: true, items: S("object", { properties: { label: S("string"), value: S("number") }, requiredKeys: ["label", "value"] }) }), empty: S("string") }), local: { selected: { type: "string", default: "" } }, events: { select: { payload: { label: "string", value: "number", index: "number" } } }, outputs: ["selected"] },
    sankey: { summary: "Flows between nodes in left-to-right layers, with widths proportional to value.", props: { label: S("string", { required: true }), nodes: S("array", { required: true, items: S("object", { properties: { id: S("string"), label: S("string") }, requiredKeys: ["id"] }) }), links: S("array", { required: true, items: S("object", { properties: { from: S("string"), to: S("string"), value: S("number") }, requiredKeys: ["from", "to", "value"] }) }), empty: S("string") } },
    map: { summary: "Choropleth of GeoJSON Polygon/MultiPolygon regions shaded by value, with optional selection.", props: selectable({ label: S("string", { required: true }), features: S("array", { required: true, items: S("object", { requiredKeys: ["id", "geometry"] }) }), empty: S("string") }), local: { selected: { type: "string", default: "" } }, events: { select: { payload: { id: "string", name: "string", value: "number|null" } } }, outputs: ["selected"] }
  };
  var CHART_NOTES = {
    "combo-chart": "categories: string[]; series: [{name,kind:'bar'|'line',values:number[]}] aligned to categories (null gaps allowed). Use to compare a volume (bars) with a rate or target (line). One axis only.",
    "stacked-bar-chart": "categories + series [{name,values}]. percent:true normalises each column to 100%. Negative values are ignored; use combo-chart for signed data.",
    "funnel-chart": "stages: [{label,value}] in order, values non-increasing for a true funnel. interactive: select emits {label,value,index}; output `selected` is the label (selecting again clears).",
    treemap: "items: [{label,value}] with positive values (up to 80). Use for part-to-whole with many parts; interactive select emits {label,value,index}; output `selected` is the label.",
    sankey: "nodes [{id,label?}], links [{from,to,value>0}]. Layers are computed left to right; links must point forward (cycles are dropped). Use for flows such as budget or conversion paths.",
    map: "features: [{id,name?,value?,geometry}] where geometry is GeoJSON Polygon or MultiPolygon in [lon,lat]. Shades by value; interactive select emits {id,name,value}; output `selected` is the id. Bring simplified boundaries: 20,000 points total."
  };
  Object.assign(freeFlowExports, { CoreComboChart: CoreComboChart, CoreStackedBarChart: CoreStackedBarChart, CoreFunnelChart: CoreFunnelChart, CoreTreemap: CoreTreemap, CoreSankey: CoreSankey, CoreMap: CoreMap });
  Object.keys(CHARTS).forEach(function (name) {
    var I = CHARTS[name]; I.role = name; I.slots = I.slots || {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    if (name === "funnel-chart" || name === "treemap") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $if: [{ $eq: [{ $self: "selected" }, { $event: "label" }] }, "", { $event: "label" }] } }] };
    if (name === "map") DEFAULTS[name] = { select: [{ do: "setLocal", key: "selected", value: { $if: [{ $eq: [{ $self: "selected" }, { $event: "id" }] }, "", { $event: "id" }] } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "accent", "wire", "success", "danger", "focus"], agent: { use: CHART_NOTES[name] } });
  });
