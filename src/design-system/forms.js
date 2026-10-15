/* Batch 5b: form extras — date range and a local file picker. Neither touches
 * the network: the file picker reads chosen files in the browser and hands the
 * document their name, size, type and (for small text files) text, as plain data.
 * See oracle/rich-artifacts.feature. */
  function isoDate(v) { return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + "T00:00:00Z")) ? v : ""; }

  function CoreDateRange(p) {
    var uid = R().useId(), v = p.value && typeof p.value === "object" ? p.value : {}, start = isoDate(v.start), end = isoDate(v.end);
    // ISO dates order lexically, so the comparison needs no Date objects (and no timezone).
    var bad = start && end && end < start ? "End date must be on or after the start date." : "", msg = p.error || bad;
    function set(patch) { fire(p.onChange, { start: patch.start !== undefined ? patch.start : start, end: patch.end !== undefined ? patch.end : end }); }
    return h("fieldset", { className: "kg-choice kg-daterange", disabled: p.disabled, "aria-invalid": msg ? true : undefined, "aria-describedby": msg ? uid + "-err" : undefined },
      h("legend", { className: "kg-field__label" }, p.label),
      h("div", { className: "kg-daterange__row" },
        h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, "From"), h("input", { className: "kg-input", type: "date", name: p.name ? p.name + "_start" : undefined, value: start, min: isoDate(p.min) || undefined, max: end || isoDate(p.max) || undefined, required: p.required, "aria-invalid": bad ? true : undefined, onChange: function (e) { set({ start: e.target.value }); } })),
        h("label", { className: "kg-field kg-free-field" }, h("span", { className: "kg-field__label" }, "To"), h("input", { className: "kg-input", type: "date", name: p.name ? p.name + "_end" : undefined, value: end, min: start || isoDate(p.min) || undefined, max: isoDate(p.max) || undefined, required: p.required, "aria-invalid": bad ? true : undefined, onChange: function (e) { set({ end: e.target.value }); } }))),
      msg ? h("span", { id: uid + "-err", className: "kg-field__error", role: "alert" }, msg) : null);
  }

  function CoreFileUpload(p) {
    var R_ = R(), uid = R_.useId(), st = R_.useState(""), note = st[0], setNote = st[1];
    var limit = Math.max(1, Math.min(1000000, Math.floor(richNum(p.maxBytes, 100000)))), many = !!p.multiple;
    var accept = typeof p.accept === "string" && /^[A-Za-z0-9.,/*+\-\s]{1,200}$/.test(p.accept) ? p.accept : undefined;
    var current = Array.isArray(p.files) ? p.files : [];
    function onPick(e) {
      var list = Array.from(e.target.files || []).slice(0, many ? 5 : 1);
      // Only small, text-like files are read: binary content in a document is
      // neither useful nor safe to inline, so those report metadata only.
      Promise.all(list.map(function (f) {
        var meta = { name: String(f.name).slice(0, 200), size: f.size, type: String(f.type || "").slice(0, 100), text: null, error: "" };
        var texty = /^text\//.test(f.type) || /json|xml|csv|javascript/.test(f.type) || /\.(txt|md|csv|json|tsv|log|yml|yaml)$/i.test(f.name);
        if (f.size > limit) { meta.error = "Larger than " + limit + " bytes; not read."; return meta; }
        if (p.readAs === "none" || !texty || typeof f.text !== "function") return meta;
        return f.text().then(function (t) { meta.text = t.slice(0, limit); return meta; }, function () { meta.error = "Could not read this file."; return meta; });
      })).then(function (files) { setNote(files.some(function (f) { return f.error; }) ? files.filter(function (f) { return f.error; }).map(function (f) { return f.name + ": " + f.error; }).join(" ") : files.length + (files.length === 1 ? " file" : " files") + " selected."); fire(p.onChange, { files: files }); });
    }
    return h("div", { className: "kg-field kg-free-field kg-fileupload" }, h("label", { className: "kg-field__label", htmlFor: uid + "-in" }, p.label),
      h("input", { id: uid + "-in", className: "kg-input", type: "file", name: p.name, accept: accept, multiple: many, disabled: p.disabled, required: p.required, "aria-describedby": uid + "-note", onChange: onPick }),
      h("span", { id: uid + "-note", className: "kg-field__help", role: "status" }, note || p.help || "Files are read in your browser and never uploaded."),
      current.length ? h("ul", { className: "kg-fileupload__list" }, current.slice(0, 5).map(function (f, i) { return h("li", { key: i }, String(f && f.name), h("span", { className: "kg-legend__value" }, f && typeof f.size === "number" ? f.size + " B" : "")); })) : null,
      p.error ? h("span", { className: "kg-field__error", role: "alert" }, String(p.error)) : null);
  }

  var FORMS = {
    "date-range": { summary: "Start and end dates with native pickers; flags an end before the start. Value is {start,end} (ISO dates).", props: { label: S("string", { required: true }), value: S("object"), name: S("string"), min: S("string"), max: S("string"), required: S("boolean"), disabled: S("boolean"), error: S("string") }, local: { value: { type: "object", default: { start: "", end: "" } } }, events: { change: { payload: { start: "string", end: "string" } } }, outputs: ["value"] },
    "file-upload": { summary: "Pick files read locally in the browser: reports name, size, type and the text of small text files; nothing is uploaded.", props: { label: S("string", { required: true }), accept: S("string"), multiple: S("boolean"), maxBytes: S("number", { default: 100000 }), readAs: S("string", { enum: ["text", "none"], default: "text" }), name: S("string"), help: S("string"), required: S("boolean"), disabled: S("boolean"), error: S("string"), files: S("array") }, local: { files: { type: "array", default: [] } }, events: { change: { payload: { files: "array" } } }, outputs: ["files"] }
  };
  var FORMS_NOTES = {
    "date-range": "Use for periods and bookings. value is {start,end}; change emits {start,end}. An end before the start shows an inline message. min/max bound both dates.",
    "file-upload": "Local read only. accept like '.csv,text/plain'; maxBytes up to 1,000,000 (default 100,000); multiple allows up to 5. change emits {files:[{name,size,type,text|null,error}]}. Bind the output into state to preview or parse it with blocks; there is no upload."
  };
  Object.assign(freeFlowExports, { CoreDateRange: CoreDateRange, CoreFileUpload: CoreFileUpload });
  Object.keys(FORMS).forEach(function (name) {
    var I = FORMS[name]; I.role = name; I.slots = {}; I.events = I.events || {}; I.outputs = I.outputs || [];
    interfaces["kages/" + name + "@1"] = I;
    DEFAULTS[name] = name === "date-range" ? { change: [{ do: "setLocal", key: "value", value: { start: { $event: "start" }, end: { $event: "end" } } }] } : { change: [{ do: "setLocal", key: "files", value: { $event: "files" } }] };
    var exportKey = "Core" + name.split("-").map(function (part) { return part[0].toUpperCase() + part.slice(1); }).join("");
    core[name] = contract("core", name, "1.0.0", "kages/" + name + "@1", freeFlowExports[exportKey], { tokens: ["paper", "surface", "sunken", "ink", "ink-muted", "line", "line-control", "danger", "focus"], agent: { use: FORMS_NOTES[name] } });
  });
