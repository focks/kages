/* Local CSV intake has an explicit preview/commit boundary. Parsing treats
 * cells as data (including formula-looking strings), bounds work and rejects
 * prototype-shaped headers before rows can enter expression state. */
  function parseCsvPreview(input, overrides) {
    var text = typeof input === "string" ? input.replace(/^\uFEFF/, "") : "", errors = [];
    if (text.length > 1000000) return { columns: [], rows: [], types: {}, errors: ["CSV exceeds 1,000,000 characters."] };
    if (!text.trim()) return { columns: [], rows: [], types: {}, errors: [] };
    var matrix = [], row = [], cell = "", quoted = false, closed = false;
    function pushCell() { row.push(cell); cell = ""; closed = false; }
    function pushRow() { pushCell(); if (row.some(function (value) { return value !== ""; })) matrix.push(row); row = []; }
    for (var i = 0; i < text.length; i++) {
      var char = text[i];
      if (quoted) {
        if (char === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else { quoted = false; closed = true; } }
        else cell += char;
      } else if (char === ',' || char === '\n' || char === '\r') {
        if (char === ',') pushCell();
        else { if (char === '\r' && text[i + 1] === '\n') i++; pushRow(); }
      } else if (char === '"' && !cell && !closed) quoted = true;
      else if (closed || char === '"') { errors.push("Unexpected text or quote after a CSV field at character " + (i + 1) + "."); break; }
      else cell += char;
      if (row.length > 50 || matrix.length > 5001) { errors.push("CSV supports at most 50 columns and 5,000 data rows."); break; }
    }
    if (quoted) errors.push("A quoted field was not closed.");
    if (cell || row.length || closed) pushRow();
    var columns = (matrix.shift() || []).map(function (name) { return name.trim(); }), seen = Object.create(null);
    columns.forEach(function (name) { if (!name || seen[name] || ["__proto__", "prototype", "constructor"].indexOf(name) >= 0) errors.push("Headers must be nonempty, unique and safe: " + name); seen[name] = true; });
    if (columns.length > 50 || matrix.length > 5000) errors.push("CSV supports at most 50 columns and 5,000 data rows.");
    matrix.forEach(function (r, index) { if (r.length !== columns.length) errors.push("Row " + (index + 2) + " has " + r.length + " fields; expected " + columns.length + "."); });
    if (errors.length) return { columns: columns.slice(0, 50), rows: [], types: {}, errors: errors.slice(0, 8) };
    var types = Object.create(null);
    function numeric(value) { return /^[-+]?(?:0|[1-9]\d*)(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(value) && isFinite(Number(value)); }
    columns.forEach(function (name, index) {
      var nonempty = matrix.map(function (r) { return r[index].trim(); }).filter(Boolean);
      var inferred = nonempty.length && nonempty.every(numeric) ? "number" : nonempty.length && nonempty.every(function (v) { return /^(true|false)$/i.test(v); }) ? "boolean" : "string";
      types[name] = overrides && Object.prototype.hasOwnProperty.call(overrides, name) ? choice(overrides[name], ["string", "number", "boolean"], inferred) : inferred;
    });
    var rows = matrix.map(function (cells, index) {
      var result = Object.create(null);
      columns.forEach(function (name, j) {
        var value = cells[j], trimmed = value.trim(), type = types[name];
        if (type === "number") {
          if (trimmed && !numeric(trimmed)) errors.push("Row " + (index + 2) + ", " + name + ": expected a finite number.");
          result[name] = trimmed && numeric(trimmed) ? Number(trimmed) : null;
        } else if (type === "boolean") {
          if (trimmed && !/^(true|false)$/i.test(trimmed)) errors.push("Row " + (index + 2) + ", " + name + ": expected true or false.");
          result[name] = trimmed ? trimmed.toLowerCase() === "true" : null;
        } else result[name] = value;
      });
      return result;
    });
    return { columns: columns, rows: errors.length ? [] : rows, types: types, errors: errors.slice(0, 8) };
  }
  function CoreCsvImport(p) {
    var React = R(), uid = React.useId(), draft = React.useState(p.text || ""), overrides = React.useState({}), notice = React.useState(""), revision = React.useRef(0);
    React.useEffect(function () { revision.current++; draft[1](p.text || ""); overrides[1]({}); notice[1](""); }, [p.text]);
    var parsed = React.useMemo(function () { return parseCsvPreview(draft[0], overrides[0]); }, [draft[0], overrides[0]]);
    function change(text) { revision.current++; draft[1](text); overrides[1]({}); notice[1](""); }
    function pick(e) {
      var file = e.target.files && e.target.files[0], token = ++revision.current;
      if (!file) return;
      if (file.size > 1000000) { notice[1]("File exceeds 1 MB; choose a smaller CSV."); return; }
      file.text().then(function (text) { if (token === revision.current) change(text); }, function () { if (token === revision.current) notice[1]("Could not read the selected file."); });
    }
    return h("section", { className: "kg-csv-import", "aria-label": p.label },
      h("h3", null, p.label), h("p", { className: "kg-chart-frame__unit" }, "Preview and choose column types before importing. Preview is local. Import applies this Kage's configured data actions."),
      h("label", { htmlFor: uid + "-file" }, "Choose CSV"), h("input", { id: uid + "-file", type: "file", accept: ".csv,text/csv", onChange: pick }),
      h("label", { htmlFor: uid + "-text" }, "Or paste CSV"), h("textarea", { id: uid + "-text", rows: 5, value: draft[0], maxLength: 1000000, onChange: function (e) { change(e.target.value); } }),
      parsed.columns.length ? h("div", { className: "kg-csv-import__types" }, parsed.columns.map(function (name) { return h("label", { key: name }, name, h("select", { value: parsed.types[name] || "string", onChange: function (e) { var next = Object.assign(Object.create(null), overrides[0]); next[name] = e.target.value; overrides[1](next); notice[1](""); } }, ["string", "number", "boolean"].map(function (type) { return h("option", { key: type, value: type }, type); }))); })) : null,
      parsed.errors.length ? h("ul", { role: "alert" }, parsed.errors.map(function (error, i) { return h("li", { key: i }, error); })) : null,
      parsed.rows.length ? h("div", { className: "kg-csv-import__preview" }, h("p", null, parsed.rows.length + " rows · preview of the first five"), dataTable("Import preview", parsed.columns, parsed.rows.slice(0, 5).map(function (row) { return parsed.columns.map(function (key) { return row[key] == null ? "–" : String(row[key]); }); }), { open: true, summary: "Preview rows" })) : null,
      h("button", { type: "button", disabled: !parsed.rows.length || !!parsed.errors.length, onClick: function () { fire(p.onImport, { rows: parsed.rows, columns: parsed.columns, types: parsed.types }); notice[1]("Imported " + parsed.rows.length + " rows into this session. Saving or sharing depends on the Kage's configured actions."); } }, "Import data"),
      notice[0] ? h("p", { role: "status" }, notice[0]) : null);
  }
  HANDLER.import = "onImport";
  interfaces["kages/csv-import@1"] = { role: "csv-import", summary: "Preview local CSV, choose safe column types, then explicitly import rows into artifact state.", props: { label: S("string", { required: true }), text: S("string"), rows: S("array"), columns: S("array", { items: S("string") }), types: S("object") }, slots: {}, local: { rows: { type: "array", default: [] }, columns: { type: "array", default: [] }, types: { type: "object", default: {} } }, outputs: ["rows", "columns", "types"], events: { import: { payload: { rows: "array", columns: "array", types: "object" } } } };
  DEFAULTS["csv-import"] = { import: [{ do: "setLocal", key: "rows", value: { $event: "rows" } }, { do: "setLocal", key: "columns", value: { $event: "columns" } }, { do: "setLocal", key: "types", value: { $event: "types" } }] };
  core["csv-import"] = contract("core", "csv-import", "1.0.0", "kages/csv-import@1", CoreCsvImport, { agent: { use: "Local CSV intake with quoted fields, type preview and explicit Import data. Bounds: 1 MB, 50 columns, 5,000 rows. Leading-zero identifiers remain strings. Public rows/columns/types update only after import; wire import to state for charts and tables. Does not upload, persist or share data by itself; make configured storage scope visible before saving." } });
  Object.assign(freeFlowExports, { CoreCsvImport: CoreCsvImport });
  freeFlowExports.parseCsvPreview = parseCsvPreview;
