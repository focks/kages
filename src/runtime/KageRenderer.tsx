"use client";
// The public renderer always crosses the sandbox boundary, including the app's own pages.
export { KageRenderer } from "./SandboxedKage.tsx";
export type { KageRendererProps } from "./EmbeddedKageRenderer.tsx";
