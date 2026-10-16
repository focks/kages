// A YAML-safe scalar for frontmatter values. A plain scalar reads fine UNLESS it
// holds an indicator that changes its meaning — most often ": " (colon-space),
// which a parser reads as a nested mapping and then drops the whole frontmatter.
// Quote only when that is the case (double-quoted YAML accepts JSON escaping), so
// an already-safe value stays exactly as written.
export const yamlStr = (s: string): string =>
  /(:(\s|$))|(\s#)|(^[\s!&*?|>%@`"'#,\-[\]{}])|(\s$)/.test(s) ? JSON.stringify(s) : s;
