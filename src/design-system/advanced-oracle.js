/* Extend the reference's public operations together. Old contracts stay intact;
 * shared pure capabilities supply only the new semantics and error findings. */
  OPS = OPS.concat(COMPUTE_OPERATORS);
  var baseEvaluate = evaluate;
  evaluate = function (x, ctx) {
    var op = x && typeof x === "object" && !Array.isArray(x) ? Object.keys(x)[0] : null;
    return COMPUTE_OPERATORS.indexOf(op) >= 0 ? computeExpression(op, x[op], ctx, evaluate, getPath) : baseEvaluate(x, ctx);
  };
  var baseValidate = validate;
  validate = function (doc, override) {
    var result = baseValidate(doc, override);
    var errors = advancedFindings(doc, function (d) { return baseValidate(d, override); }, isExpr, walkExpr, function (type) { return resolve(result.system, type).contract; });
    if (result.ok && !errors.length) {
      try { var expanded = expandDocument(doc, makeCtx(doc, result.system, doc.state || {}, initLocals(doc, result.system)), evaluate, getPath, function (d) { return makeCtx(d, result.system, doc.state || {}, initLocals(d, result.system)); });
        var ctx = makeCtx(expanded, result.system, doc.state || {}, initLocals(expanded, result.system));
        Object.keys(expanded.blocks).forEach(function (id) { var b = expanded.blocks[id]; if (b.type === "composition" && doc.compositions && doc.compositions[b.props.name] && doc.compositions[b.props.name].outputType) ctx.output(id); });
      }
      catch (e) { errors.push({ at: "/blocks", code: "bad-expansion", msg: e.message }); }
    }
    return merge(result, { ok: result.ok && !errors.length, errors: result.errors.concat(errors) });
  };
  var baseDescribe = describe;
  describe = function (doc, override, state) {
    var sys = systemOf(doc, override), count = Object.keys(doc.blocks || {}).length;
    var expanded = expandDocument(doc, makeCtx(doc, sys, state || doc.state || {}, initLocals(doc, sys)), evaluate, getPath, function (d) { return makeCtx(d, sys, state || doc.state || {}, initLocals(d, sys)); });
    var text = baseDescribe(expanded, override, state);
    var instances = Object.keys(expanded.blocks).length;
    return text.replace(" · " + instances + " blocks\n", " · " + count + " blocks" + (instances !== count ? " · " + instances + " instances" : "") + "\n");
  };
  var baseSchema = generationSchema;
  generationSchema = function (sys) {
    var schema = baseSchema(sys);
    schema.required.splice(4, 0, "compositions_json");
    schema.properties.compositions_json = { type: ["string", "null"], description: "JSON object of local compositions: typed inputs, root, blocks, optional output" };
    schema.properties.blocks.items.anyOf.forEach(function (v) {
      v.required.push("repeat_json");
      v.properties.repeat_json = { type: ["string", "null"], description: "Repeat template: JSON {each, as?, key?}; null for one instance" };
    });
    return schema;
  };
  var baseToGenerated = toGenerated;
  toGenerated = function (doc, sys) {
    var envelope = baseToGenerated(doc, sys);
    envelope.compositions_json = doc.compositions ? JSON.stringify(doc.compositions) : null;
    envelope.blocks.forEach(function (g) {
      var b = doc.blocks[g.id], c = resolve(systemOf(doc, sys), b.type).contract;
      g.repeat_json = b.repeat === undefined ? null : JSON.stringify(b.repeat);
      var props = merge(b.props || {}, ((b.props || {}).x || {})[systemOf(doc, sys)] || {});
      var expressions = {};
      Object.keys(props).forEach(function (key) { if (c.props[key] && strictOf(c.props[key]) && isExpr(props[key])) expressions[key] = props[key]; });
      expressions = merge(expressions, b.bind || {});
      g.bind = Object.keys(expressions).map(function (key) { return { prop: key, expr_json: JSON.stringify(expressions[key]) }; });
    });
    return envelope;
  };
  var baseFromGenerated = fromGenerated;
  fromGenerated = function (g, sys) {
    var doc = baseFromGenerated(g, sys);
    var compositions = parseJ(g.compositions_json, null); if (compositions) doc.compositions = compositions;
    (g.blocks || []).forEach(function (b) { if (b.repeat_json) doc.blocks[b.id].repeat = parseJ(b.repeat_json); });
    return doc;
  };
