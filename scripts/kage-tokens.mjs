// Compiles the design-system bundle's tokens.json into a stylesheet SCOPED to
// the Kage root (.kg-kage), never :root. Core's tokens are unprefixed (--accent,
// --radius-md, --font-sans) and would otherwise collide with the app chrome's
// own variables of the same names; scoping keeps the two vocabularies apart.
import { readFileSync, writeFileSync } from "node:fs";
const [src = "public/ds/tokens.json", out = "public/ds/tokens.css"] = process.argv.slice(2);
const t = JSON.parse(readFileSync(src, "utf8"));
const themes = t.color.themes.map((x) => x.id);
const themed = [...t.color.tokens, ...(t.shadow?.tokens ?? [])];
const val = (tok, th) => (typeof tok.value === "string" ? tok.value : tok.value[th] ?? tok.value[themes[0]]);
const block = (sel, lines) => `${sel} {\n${lines.map((l) => `  ${l}`).join("\n")}\n}\n`;
const flat = ["spacing", "radius", "zIndex"].flatMap((k) => t[k]?.tokens ?? []).map((x) => `--${x.name}: ${x.value};`);
const fonts = Object.entries(t.type.families).map(([k, v]) => `--font-${k}: ${v};`);
let css = `/* generated from ${src} by scripts/kage-tokens.mjs (do not edit) */\n`;
css += block(".kg-kage", [...themed.map((x) => `--${x.name}: ${val(x, themes[0])};`), ...flat, ...fonts]);
for (const th of themes.slice(1)) css += block(`.${th} .kg-kage`, themed.map((x) => `--${x.name}: ${val(x, th)};`));
writeFileSync(out, css);
console.log(`${out}: ${themed.length} themed + ${flat.length} flat tokens, ${themes.length} themes`);
