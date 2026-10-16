// Static checks over the design system's CSS, so rules that cannot be seen in a unit
// test of a component (motion policy, browser surfaces) are still enforced on every
// `npm test`. A deliberately small parser: it understands rules, one level of @media
// nesting, comments and strings, which is all the bundle uses.
export interface Rule { selector: string; body: string; at?: string; index: number }

export function stripComments(css: string): string { return css.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length)); }

/** Flatten rules, tagging those inside an at-rule (e.g. "@media (prefers-reduced-motion: reduce)"). */
export function parseRules(source: string): Rule[] {
  const css = stripComments(source), out: Rule[] = [];
  const walk = (start: number, end: number, at?: string) => {
    let i = start;
    while (i < end) {
      const open = css.indexOf("{", i);
      if (open < 0 || open >= end) break;
      let depth = 1, j = open + 1;
      while (j < end && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
      const head = css.slice(i, open).trim(), inner = css.slice(open + 1, j - 1);
      if (head.startsWith("@media") || head.startsWith("@supports")) walk(open + 1, j - 1, head);
      else if (!head.startsWith("@")) out.push({ selector: head, body: inner.trim(), ...(at ? { at } : {}), index: i });
      else if (head.startsWith("@keyframes")) out.push({ selector: head, body: inner.trim(), ...(at ? { at } : {}), index: i });
      i = j;
    }
  };
  walk(0, css.length);
  return out;
}

const decls = (body: string) => body.split(";").map((d) => d.trim()).filter(Boolean).map((d) => { const k = d.indexOf(":"); return [d.slice(0, k).trim().toLowerCase(), d.slice(k + 1).trim()] as const; });
export const declarationsOf = (r: Rule) => decls(r.body);

export interface Issue { selector: string; message: string }

/** Motion policy for CSS WE author: tokens only, no overshoot, no ambient loops. */
export function checkMotion(source: string): Issue[] {
  const issues: Issue[] = [];
  for (const r of parseRules(source)) {
    if (r.selector.startsWith("@keyframes")) { issues.push({ selector: r.selector, message: "keyframes animations are not allowed: motion communicates a state change with a transition" }); continue; }
    for (const [prop, value] of declarationsOf(r)) {
      if (prop === "transition" || prop === "transition-duration" || prop === "transition-timing-function" || prop === "animation" || prop === "animation-duration" || prop === "animation-timing-function") {
        if (/^none\b|^0s\b|^0ms\b/.test(value) || (r.at && /reduce/.test(r.at))) continue;
        if (/\binfinite\b/.test(value)) issues.push({ selector: r.selector, message: "an infinite animation is ambient motion" });
        for (const m of value.matchAll(/cubic-bezier\(([^)]*)\)/g)) {
          const n = m[1].split(",").map((x) => Number(x.trim()));
          if (n.length !== 4 || n.some(Number.isNaN) || n[1] < 0 || n[1] > 1 || n[3] < 0 || n[3] > 1 || n[0] < 0 || n[0] > 1 || n[2] < 0 || n[2] > 1) issues.push({ selector: r.selector, message: `cubic-bezier(${m[1]}) overshoots; bounce and elastic easing are banned` });
        }
        if (/\bsteps\(/.test(value)) issues.push({ selector: r.selector, message: "stepped animation is decoration" });
        const timing = value.replace(/cubic-bezier\([^)]*\)/g, "").replace(/var\(--motion-[a-z-]+\)/g, "").replace(/\b(transform|opacity|width|height|color|background|background-color|border-color|box-shadow|filter|all|inset-inline-start|left|right|top|stroke|fill|visibility|outline-color|clip-path|max-height)\b/g, "").replace(/[,\s]+/g, " ").trim();
        if (!/var\(--motion-duration-[a-z]+\)/.test(value) || timing) issues.push({ selector: r.selector, message: `"${prop}: ${value}" must use var(--motion-duration-*) and var(--motion-ease-*), not literal timings` });
      }
    }
  }
  return issues;
}

/** Declarations that hide a focus ring without replacing it. */
export function findHiddenFocus(source: string): Issue[] {
  const out: Issue[] = [];
  for (const r of parseRules(source)) for (const [prop, value] of declarationsOf(r)) if (prop === "outline" && /^(none|0)\b/.test(value) && !/:focus-within/.test(r.selector)) out.push({ selector: r.selector, message: `outline: ${value} removes the focus ring` });
  return out;
}
