import type { Finding, Rule } from "./types.ts";

export const insecureMedia: Rule = {
  id: "insecure-media", category: "media", severity: "P1", tier: "immediate",
  summary: "Media loaded over http://.",
  rationale: "Only https or local sources render, so the video, audio or image silently never appears.",
  check({ blocks }) {
    const out: Finding[] = [];
    for (const [id, b] of Object.entries(blocks)) {
      const p = (b.props ?? {}) as Record<string, unknown>, base = "/blocks/" + id;
      if ((b.type === "video" || b.type === "audio") && typeof p.src === "string" && /^http:\/\//i.test(p.src))
        out.push({ at: `${base}/props/src`, msg: `\`${id}\` uses an http:// source; media must be https or a local path, so it will not play.`, fix: "Use the https:// URL." });
      if (b.type === "gallery") for (const [i, it] of (Array.isArray(p.items) ? p.items : []).entries())
        if (typeof (it as { src?: unknown })?.src === "string" && /^http:\/\//i.test((it as { src: string }).src))
          out.push({ at: `${base}/props/items/${i}/src`, msg: `Gallery image ${i + 1} uses http://; only https or local images render.`, fix: "Use the https:// URL." });
    }
    return out;
  },
};
