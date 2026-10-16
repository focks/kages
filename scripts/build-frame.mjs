// A separate browser entry keeps Next's application/session code outside frames.
import { build } from "esbuild";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
mkdirSync("public/runtime", { recursive: true });
const result = await build({ entryPoints: ["src/runtime/frame-entry.tsx"], bundle: true, platform: "browser", format: "iife", target: "es2022", minify: true, write: false, define: { "process.env.NODE_ENV": '"production"' } });
const bytes = result.outputFiles[0].contents;
const id = createHash("sha256").update(bytes).digest("hex");
const integrity = "sha384-" + createHash("sha384").update(bytes).digest("base64");
writeFileSync(`public/runtime/${id}.js`, bytes);
writeFileSync("public/runtime/frame.json", JSON.stringify({ path: `/runtime/${id}.js`, integrity }, null, 2) + "\n");

await import("./pin-ds-assets.mjs");
