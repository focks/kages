/* Presentation choices are closed enums, so an agent can art-direct a region
 * without supplying CSS. New contracts retain the old refs and implementations
 * for pinned documents. Palette CSS is generated from the checked token recipes. */
  var REGION_PALETTES = ["inherit", "ocean", "mint", "violet", "amber", "rose"];
  function regionPalette(value) { return choice(value, REGION_PALETTES, "inherit"); }
  function CoreSectionV2(p) {
    var scale = choice(p.scale, ["standard", "hero"], "standard");
    var level = choice(p.level, [1, 2, 3, 4], scale === "hero" ? 1 : 2);
    return h("section", { className: "kg-section kg-section--" + choice(p.tone, ["plain", "surface", "sunken", "accent"], "plain") + " kg-section--" + scale + " kg-palette-" + regionPalette(p.palette) + " kg-section--" + choice(p.backdrop, ["flat", "wash"], "flat"), style: spacingProps(p), "aria-label": p.title || undefined },
      p.eyebrow ? h("p", { className: "kg-section__eyebrow" }, p.eyebrow) : null,
      p.title ? h("h" + level, { className: "kg-section__title" }, p.title) : null,
      p.description ? h("p", { className: "kg-section__description" }, p.description) : null,
      h("div", { className: "kg-section__content" }, p.children),
      p.actions && p.actions.length ? h("div", { className: "kg-section__actions" }, p.actions) : null);
  }
  core.section = contract("core", "section", "1.1.0", "kages/section@1", CoreSectionV2, {
    props: { level: S("number", { enum: [1, 2, 3, 4], default: 2 }), palette: S("string", { enum: REGION_PALETTES, default: "inherit" }), scale: S("string", { enum: ["standard", "hero"], default: "standard" }), backdrop: S("string", { enum: ["flat", "wash"], default: "flat" }) },
    tokens: contracts["core/section@1.0.0"].tokens,
    agent: { use: "Compose heroes and chapters. Use scale:hero with level:1 for the opening, palette:ocean|mint|violet|amber|rose for a meaningful colour family, tone:accent for a tinted region, and backdrop:wash for a soft gradient. Palette affects the region and its controls in both themes; inherit preserves the workspace design. Reuse colours by meaning. Bind title, description or palette to state for a live result. Avoid a box around every section." }
  });
  Object.assign(interfaces["kages/section@1"].props, contracts[core.section].props);
  Object.assign(freeFlowExports, { CoreSectionV2: CoreSectionV2 });

  // Role resolution follows the current system; signed lockfiles instead need
  // the exact registered implementation, including superseded contract versions.
  freeFlowExports.implementation = function (ref) {
    return Object.prototype.hasOwnProperty.call(impls, ref) ? impls[ref] : undefined;
  };
