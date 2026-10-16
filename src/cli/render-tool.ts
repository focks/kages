// The `render_kage` MCP tool: the visual review loop for agents. It returns the
// screenshot as an image content block (so a vision model literally sees the
// page) with the objective findings as text. Local-only: it needs Chrome and a
// running app, so it is added to the stdio server and never to the hosted route.

import type { KageDoc } from "../engine/types.ts";
import type { LocalTools } from "../adapters/mcp.ts";
import { screenshotDoc, parseWidths, DEFAULTS } from "./screenshot.ts";

type CallOp = (name: string, params: Record<string, unknown>) => Promise<{ ok: boolean; data?: unknown; error?: { msg: string } }>;

export function renderTool(resolve: (nameOrFile: string) => KageDoc, callOp?: CallOp): LocalTools {
  return {
    tools: [{
      name: "render_kage",
      description: "Render a stored Kage (by name) or a document in a headless browser and return a screenshot plus checks: blocks that failed to render, sideways scroll, broken images, console errors. Use it to look at your own work. Needs Chrome and a running Kages app.",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "A stored Kage name or a .kage.json path" },
          doc: { type: "object", description: "A full document to render instead of a stored one" },
          width: { type: "number", description: "Viewport width in px (240–3840), default 1200. Try 390 for mobile." },
          dark: { type: "boolean", description: "Render in the dark theme" },
          system: { type: "string", description: "Override the design system (core, ledger, atelier)" },
        },
      },
    }, ...(callOp ? [{
      name: "critique_packet",
      description: "Everything critique_kage returns, plus screenshots rendered locally (an image per width) and their layout findings. Use this when you can see images; use critique_kage on a hosted server. Needs Chrome and a running Kages app.",
      inputSchema: {
        type: "object",
        properties: { name: { type: "string", description: "A stored Kage name" }, widths: { type: "string", description: "Comma-separated viewport widths, default 390,1200" }, dark: { type: "boolean" } },
        required: ["name"],
      },
    }] : [])],
    async call(name, args) {
      if (name === "critique_packet" && callOp) {
        try {
          const doc = resolve(String(args.name));
          const widths = parseWidths(args.widths ?? "390,1200");
          const shots = await screenshotDoc(doc, { ...DEFAULTS, widths, dark: args.dark === true, noSandbox: process.env.KAGES_CHROME_NO_SANDBOX === "1" });
          const render = { widths: shots.map((s) => s.width), findings: shots.flatMap((s) => s.issues.map((i) => `${s.width}px: ${i}`)) };
          const r = await callOp("critique_kage", { name: args.name, render });
          if (!r.ok) return { isError: true, content: [{ type: "text", text: r.error?.msg ?? "critique_kage failed" }] };
          return { content: [...shots.map((s) => ({ type: "image", data: s.png.toString("base64"), mimeType: "image/png" })), { type: "text", text: JSON.stringify(r.data) }] };
        } catch (e) {
          return { isError: true, content: [{ type: "text", text: `critique_packet failed: ${(e as Error).message}. Call critique_kage for the evidence without images.` }] };
        }
      }
      if (name !== "render_kage") return undefined;
      try {
        const doc = (args.doc as KageDoc | undefined) ?? (typeof args.name === "string" ? resolve(args.name) : undefined);
        if (!doc) return { isError: true, content: [{ type: "text", text: "give either `name` or `doc`" }] };
        const [shot] = await screenshotDoc(doc, { ...DEFAULTS, widths: parseWidths(args.width ?? DEFAULTS.widths[0]), dark: args.dark === true, system: typeof args.system === "string" ? args.system : undefined, noSandbox: process.env.KAGES_CHROME_NO_SANDBOX === "1" });
        const text = `${shot.width}×${shot.height}px · ${shot.metrics.blocks} blocks · ${shot.issues.length ? shot.issues.length + " finding(s):\n- " + shot.issues.join("\n- ") : "no problems found"}`;
        return { content: [{ type: "image", data: shot.png.toString("base64"), mimeType: "image/png" }, { type: "text", text }] };
      } catch (e) {
        return { isError: true, content: [{ type: "text", text: `render_kage failed: ${(e as Error).message}` }] };
      }
    },
  };
}
