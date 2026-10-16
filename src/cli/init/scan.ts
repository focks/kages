// What the project already says about itself, gathered before anyone is asked.
// Repository text is a HYPOTHESIS, not approval: everything taken from here is
// marked `inferred` until a person confirms it. Pure over an injected file reader
// so it is table-testable; every read is bounded because a README is untrusted.

export interface FsLike { readText(path: string): string | null }

export interface Hint { value: string; source: string }
export interface Hypothesis {
  purpose?: Hint;
  positioning?: Hint;
  projectName?: Hint;
  /** Existing Kages, for display only; they never feed the brief. */
  existingKages: { title: string; mode?: string; system: string }[];
}

const MAX_READ = 64 * 1024;
const MAX_HINT = 400;

const clip = (s: string): string => {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length <= MAX_HINT ? t : t.slice(0, MAX_HINT - 1).trimEnd() + "…";
};

export function scanPackageJson(text: string | null): { name?: string; description?: string } {
  if (!text) return {};
  try {
    const p = JSON.parse(text.slice(0, MAX_READ)) as { name?: unknown; description?: unknown };
    return { ...(typeof p.name === "string" ? { name: p.name } : {}), ...(typeof p.description === "string" && p.description.trim() ? { description: clip(p.description) } : {}) };
  } catch { return {}; }
}

/** First heading and first prose paragraph, skipping badges, images, HTML and code. */
export function scanReadme(text: string | null): { heading?: string; paragraph?: string } {
  if (!text) return {};
  const lines = text.slice(0, MAX_READ).replace(/\r\n/g, "\n").split("\n");
  let heading: string | undefined, para: string[] = [], inFence = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^(```|~~~)/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const h = /^#{1,6}\s+(.+)$/.exec(line);
    if (h) { if (!heading) heading = clip(h[1]); else if (para.length) break; continue; }
    // Badge rows, standalone images, HTML tags and bare links are not prose.
    const prose = line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/<[^>]+>/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim();
    if (prose === "" || /^[|>\-*=_]{1,}$/.test(prose) || /^\[!\[/.test(line)) { if (para.length) break; continue; }
    if (/^[-*+]\s|^\d+\.\s|^\|/.test(prose)) { if (para.length) break; continue; }
    para.push(prose);
  }
  return { ...(heading ? { heading } : {}), ...(para.length ? { paragraph: clip(para.join(" ")) } : {}) };
}

export function scanProject(fs: FsLike, kages: Hypothesis["existingKages"] = []): Hypothesis {
  const pkg = scanPackageJson(fs.readText("package.json"));
  const readme = scanReadme(fs.readText("README.md") ?? fs.readText("readme.md"));
  const h: Hypothesis = { existingKages: kages };
  if (pkg.name) h.projectName = { value: pkg.name, source: "package.json name" };
  if (pkg.description) h.purpose = { value: pkg.description, source: "package.json description" };
  if (readme.paragraph) {
    if (!h.purpose) h.purpose = { value: readme.paragraph, source: "README intro" };
    else if (readme.paragraph !== pkg.description) h.positioning = { value: readme.paragraph, source: "README intro" };
  }
  if (readme.heading && !h.projectName) h.projectName = { value: readme.heading, source: "README heading" };
  return h;
}
